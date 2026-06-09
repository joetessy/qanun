import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
import { reverbSizeToParams } from './reverbSize'
import { velocityCurve } from './velocityCurve'
import { nextVoiceIndex } from './voicePool'
import { detunedFreqs } from './detuneCluster'

// Per-course plucked-string engine. P1 voice = Tone.PluckSynth (Karplus-Strong);
// P2 swaps in a Tone.Sampler behind this same `pluck()` interface. A pool of
// monophonic voices gives polyphony for chords + fast runs (voice stealing).
//
// v2 changes (per §3 of 2026-06-09-interaction-v2-and-sound.md):
//   • Triple-course bloom: each pluck fires 3 detuned voices (±4 cents).
//   • Longer ring: resonance ↑ to 0.97, dampening 3500 Hz for warmer tone.
//   • Body reverb on by default (wet ≈ 0.28).
//   • Rashsh hold: holdStart() re-triggers at ~7 Hz; holdStop() cancels.
export interface QanunEngineOptions {
  Tone?: typeof ToneNamespace // injectable for tests (see createDrone.ts)
  polyphony?: number           // logical note polyphony (pool = polyphony × 3)
  fx?: Partial<{ reverbEnabled: boolean; reverbWet: number; reverbSize: ReverbSize }>
}

export interface QanunEngine {
  start: () => Promise<void>
  dispose: () => void
  pluck: (args: { freqHz: number; velocity: number; time?: number }) => void
  holdStart: (args: { freqHz: number; velocity: number }) => void
  holdStop: () => void
  setReverbEnabled: (enabled: boolean) => void
  setReverbWet: (wet: number) => void
  setReverbSize: (size: ReverbSize) => void
  getSampleRate: () => number
  readonly sumBus: Gain
  readonly isStarted: boolean
}

// ─── constants ────────────────────────────────────────────────────────────────

/** Triple-course cent offsets — one voice per string in the unison course. */
const COURSE_CENTS = [-4, 0, 4] as const

/** Voices per note (= COURSE_CENTS.length). */
const VOICES_PER_NOTE = COURSE_CENTS.length

/** Rashsh tremolo rate in Hz (~7 picks/s, standard Arabic ornament). */
const RASHSH_HZ = 7

/**
 * Pluck interval for Tone.Loop (in seconds).
 * A small constant offset staggers the repeated attack slightly for realism.
 */
const RASHSH_INTERVAL = 1 / RASHSH_HZ

/**
 * Velocity variation range for rashsh re-triggers (± this fraction of base).
 * Keeps the tremolo from sounding mechanical.
 */
const RASHSH_VELOCITY_JITTER = 0.12

// Tuned Karplus-Strong timbre for a warm, long-ringing qanun string:
//   resonance 0.97 → ~1.5–2 s natural decay at 440 Hz
//   dampening  3500 Hz → slightly warmer than full brightness
const KS_RESONANCE = 0.97
const KS_DAMPENING = 3500

// Default reverb: subtle "body" resonance (medium room, low wet).
const DEFAULT_REVERB_WET = 0.28
const DEFAULT_REVERB_SIZE: ReverbSize = 'medium'

const FX_WET_RAMP = 0.08
const VOICE_GAIN_RAMP = 0.01
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

// ─── factory ──────────────────────────────────────────────────────────────────

export const createQanunEngine = ({
  Tone = ToneNamespace,
  polyphony = 8,               // 8 simultaneous notes × 3 voices = 24 in pool
  fx
}: QanunEngineOptions = {}): QanunEngine => {
  let reverbEnabled = fx?.reverbEnabled ?? true
  let reverbWet = fx?.reverbWet ?? DEFAULT_REVERB_WET
  let reverbSize: ReverbSize = fx?.reverbSize ?? DEFAULT_REVERB_SIZE

  // Chain: voice[i] → voiceGain[i] → reverb → sumBus → destination.
  const sumBus = new Tone.Gain(1).toDestination()
  const params = reverbSizeToParams(reverbSize)
  const reverb = new Tone.Reverb({
    decay: params.decaySec,
    preDelay: params.preDelaySec,
    wet: reverbEnabled ? clamp01(reverbWet) : 0
  })
  reverb.connect(sumBus)

  // Pool has `polyphony × VOICES_PER_NOTE` raw voices so that chords (each
  // needing 3 voices) still get their full triple-course allocation.
  const poolSize = polyphony * VOICES_PER_NOTE
  const voices = Array.from({ length: poolSize }, () => {
    const g = new Tone.Gain(0)
    g.connect(reverb)
    // Karplus-Strong qanun timbre: long resonance, warm dampening.
    const synth = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: KS_DAMPENING,
      resonance: KS_RESONANCE
    })
    synth.connect(g)
    return { synth, gain: g }
  })

  // Round-robin cursor — tracks the last allocated voice slot.
  let voiceIndex = -1
  let started = false

  // ── rashsh state ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let activeLoop: any = null

  // ── internal helpers ────────────────────────────────────────────────────────

  /** Allocate the next voice from the pool (round-robin). */
  const allocVoice = () => {
    voiceIndex = nextVoiceIndex(voiceIndex < 0 ? voices.length - 1 : voiceIndex, voices.length)
    return voices[voiceIndex]
  }

  /** Fire a single raw attack on one voice (used by both pluck and rashsh). */
  const fireVoice = (
    freqHz: number,
    gainValue: number,
    time?: number
  ): void => {
    const v = allocVoice()
    v.gain.gain.rampTo(gainValue, VOICE_GAIN_RAMP)
    v.synth.triggerAttack(freqHz, time)
  }

  // ── public methods ──────────────────────────────────────────────────────────

  const start = async (): Promise<void> => {
    if (started) return
    await Tone.start()
    started = true
  }

  /**
   * Pluck a note: fires one voice per COURSE_CENTS offset (triple-course bloom).
   * Signature unchanged from v1 — all call-sites remain valid.
   */
  const pluck = ({
    freqHz,
    velocity,
    time
  }: {
    freqHz: number
    velocity: number
    time?: number
  }): void => {
    if (!Number.isFinite(freqHz) || freqHz <= 0) return
    const gainValue = velocityCurve(clamp01(velocity))
    for (const freq of detunedFreqs(freqHz, [...COURSE_CENTS])) {
      fireVoice(freq, gainValue, time)
    }
  }

  /**
   * Start rashsh sustain: repeatedly re-trigger the note at RASHSH_HZ (~7 Hz)
   * with slight velocity jitter, until holdStop() is called.
   * Only one hold is active at a time (calling again replaces the previous).
   */
  const holdStart = ({ freqHz, velocity }: { freqHz: number; velocity: number }): void => {
    holdStop() // cancel any previous hold
    if (!Number.isFinite(freqHz) || freqHz <= 0) return

    // Immediate first attack.
    pluck({ freqHz, velocity })

    // Tone.Transport must be running for Tone.Loop to fire.
    Tone.Transport.start()

    activeLoop = new Tone.Loop((time: number) => {
      const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
      const v = clamp01(velocity + jitter)
      for (const freq of detunedFreqs(freqHz, [...COURSE_CENTS])) {
        fireVoice(freq, velocityCurve(v), time)
      }
    }, RASHSH_INTERVAL)

    activeLoop.start(0)
  }

  /**
   * Stop the active rashsh sustain loop (if any).
   */
  const holdStop = (): void => {
    if (activeLoop) {
      activeLoop.stop()
      activeLoop.dispose()
      activeLoop = null
    }
  }

  const applyReverbWet = (): void => {
    reverb.wet.rampTo(reverbEnabled ? clamp01(reverbWet) : 0, FX_WET_RAMP)
  }
  const setReverbEnabled = (enabled: boolean): void => {
    reverbEnabled = enabled
    applyReverbWet()
  }
  const setReverbWet = (wet: number): void => {
    reverbWet = clamp01(wet)
    applyReverbWet()
  }
  const setReverbSize = (size: ReverbSize): void => {
    reverbSize = size
    const p = reverbSizeToParams(size)
    reverb.decay = p.decaySec
    reverb.preDelay = p.preDelaySec
  }

  const dispose = (): void => {
    holdStop()
    voices.forEach((v) => {
      v.synth.dispose()
      v.gain.dispose()
    })
    reverb.dispose()
    sumBus.dispose()
  }

  const getSampleRate = (): number => Tone.getContext().sampleRate

  return {
    start,
    dispose,
    pluck,
    holdStart,
    holdStop,
    setReverbEnabled,
    setReverbWet,
    setReverbSize,
    getSampleRate,
    get sumBus() {
      return sumBus as unknown as Gain
    },
    get isStarted() {
      return started
    }
  }
}

// Re-export for callers that attach practice/recorder taps later (P4).
export type { ToneAudioNode }
