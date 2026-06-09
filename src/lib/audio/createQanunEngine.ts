import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
import { reverbSizeToParams } from './reverbSize'
import { velocityCurve } from './velocityCurve'
import { nextVoiceIndex } from './voicePool'
import { detunedFreqs } from './detuneCluster'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

// Per-course plucked-string engine. P1 voice = Tone.PluckSynth (Karplus-Strong);
// P2 adds a Tone.Sampler behind the same `pluck()` interface.
//
// Sound source routing:
//   'sample' (default) — uses Tone.Sampler once loaded; falls back to synth while loading.
//   'synth' — always uses the PluckSynth pool.
//
// Signal chain (sumBus → limiter → destination; limiter brick-walls at -1 dBFS
// so dense plucks + rashsh + reverb can't clip):
//   Sampler → chorus (triple-course shimmer for sampled path) → Vibrato → reverb → sumBus
//   PluckSynth voices → voiceGain → Vibrato → reverb → sumBus
//
// v2 changes (per §3 of 2026-06-09-interaction-v2-and-sound.md):
//   • Triple-course bloom: each pluck fires 3 detuned voices (±4 cents).
//   • Longer ring: resonance ↑ to 0.97, dampening 3500 Hz for warmer tone.
//   • Body reverb on by default (wet ≈ 0.28).
//   • Rashsh hold: holdStart() re-triggers at ~10 Hz; holdStop() cancels.
//   • Vibrato: a Tone.Vibrato effect node sits in the dry path (before reverb),
//     bending the pitch of everything that flows through it. Because both the
//     sampler and the synth fallback route through it, vibrato works for BOTH
//     voices, on a ringing/sustained note AND during the rashsh tremolo
//     (Tone v15's Sampler has no `detune` param, so an LFO→detune approach is
//     silent — the effect node bends the post-mix signal instead). setVibrato()
//     drives its depth/rate live; depth 0 ⇒ inaudible.
export type SoundSource = 'sample' | 'synth'

export interface QanunEngineOptions {
  Tone?: typeof ToneNamespace // injectable for tests (see createDrone.ts)
  polyphony?: number           // logical note polyphony (pool = polyphony × 3)
  fx?: Partial<{ reverbEnabled: boolean; reverbWet: number; reverbSize: ReverbSize }>
}

export interface QanunEngine {
  start: () => Promise<void>
  dispose: () => void
  pluck: (args: { freqHz: number; velocity: number; time?: number }) => void
  holdStart: (args: { freqHz: number; velocity: number; immediate?: boolean }) => void
  holdAlternate: (args: { freqs: number[]; velocity: number }) => void
  holdStop: () => void
  setVibrato: (a: { cents: number; rateHz?: number }) => void
  trill: (args: { freqHz: number; neighborHz: number; velocity: number; cycles?: number }) => void
  setReverbEnabled: (enabled: boolean) => void
  setReverbWet: (wet: number) => void
  setReverbSize: (size: ReverbSize) => void
  getSampleRate: () => number
  getRecorderTap: () => AudioNode
  readonly sumBus: Gain
  readonly isStarted: boolean
  // P2: sampler voice switching
  setSoundSource: (source: SoundSource) => void
  readonly soundSource: SoundSource
  readonly isSampleLoaded: boolean
}

// ─── constants ────────────────────────────────────────────────────────────────

/** Triple-course cent offsets — one voice per string in the unison course. */
const COURSE_CENTS = [-4, 0, 4] as const

/** Voices per note (= COURSE_CENTS.length). */
const VOICES_PER_NOTE = COURSE_CENTS.length

/** Rashsh tremolo rate in Hz (~10 picks/s — a brisk Arabic tremolo). */
const RASHSH_HZ = 10

/**
 * Pluck interval for Tone.Loop (in seconds).
 * A small constant offset staggers the repeated attack slightly for realism.
 */
const RASHSH_INTERVAL = 1 / RASHSH_HZ

/**
 * Alternation rate (Hz) for a two-string hold (holdAlternate). Deliberately
 * slower than the single-note rashsh (RASHSH_HZ) so the two pitches are
 * individually audible as a back-and-forth instead of blurring into a unison
 * tremolo. ~5.5 Hz ⇒ each note sounds ~0.18 s per turn.
 */
const ALTERNATE_HZ = 5.5
const ALTERNATE_INTERVAL = 1 / ALTERNATE_HZ

/** Trill attack spacing — same 7 Hz rhythm as rashsh, but finite. */
const TRILL_HZ = 7
const TRILL_INTERVAL = 1 / TRILL_HZ
/** Default trill cycles: principal–neighbor pairs + final principal = 2*4+1 = 9 attacks. */
const TRILL_DEFAULT_CYCLES = 4

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

// Subtle chorus on the sampled path to reinforce the triple-course shimmer.
const CHORUS_FREQUENCY = 1.5   // Hz — slow LFO, avoids obvious wobble
const CHORUS_DELAY_TIME = 3.5  // ms — moderate width
const CHORUS_DEPTH = 0.15      // low depth for subtlety
const CHORUS_WET = 0.35        // blend: mostly dry, gentle shimmer

const FX_WET_RAMP = 0.08
const VOICE_GAIN_RAMP = 0.01
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Maximum vibrato depth in cents (full-scale pitch bend at the Vibrato extremes). */
const MAX_VIBRATO_CENTS = 45

// ─── factory ──────────────────────────────────────────────────────────────────

export const createQanunEngine = ({
  Tone = ToneNamespace,
  polyphony = 8,               // 8 simultaneous notes × 3 voices = 24 in pool
  fx
}: QanunEngineOptions = {}): QanunEngine => {
  let reverbEnabled = fx?.reverbEnabled ?? true
  let reverbWet = fx?.reverbWet ?? DEFAULT_REVERB_WET
  let reverbSize: ReverbSize = fx?.reverbSize ?? DEFAULT_REVERB_SIZE

  // ── shared output chain ──────────────────────────────────────────────────────
  // Both voices route through Vibrato → reverb → sumBus → limiter → destination.
  // sumBus runs at 0.8 for a little headroom; a brick-wall limiter at -1 dBFS
  // sits at the very end so triple-course plucks + rashsh + reverb can't sum
  // past 0 dBFS and clip. The limiter is guarded for the injectable Tone mock
  // (which may not implement it); when absent, sumBus drives the destination
  // directly so tests still work.
  const sumBus = new Tone.Gain(0.8)
  const limiter = typeof Tone.Limiter === 'function' ? new Tone.Limiter(-1) : null
  if (limiter) {
    sumBus.connect(limiter)
    limiter.toDestination()
  } else {
    sumBus.toDestination()
  }
  const params = reverbSizeToParams(reverbSize)
  const reverb = new Tone.Reverb({
    decay: params.decaySec,
    preDelay: params.preDelaySec,
    wet: reverbEnabled ? clamp01(reverbWet) : 0
  })
  reverb.connect(sumBus)

  // ── vibrato (pitch-bend effect on the dry path, before reverb) ────────────────
  // A Tone.Vibrato node bends the pitch of EVERYTHING routed through it, so both
  // the sampler and the synth fallback vibrato — on a ringing/sustained note as
  // well as during the rashsh tremolo. (Tone v15's Sampler exposes no `detune`
  // AudioParam, so the old LFO→detune approach was silent; bending the post-mix
  // signal sidesteps that.) Sits between the sources and reverb so the dry
  // signal is bent before it hits the reverb tail. setVibrato() drives its
  // depth/rate live; depth 0 ⇒ inaudible.
  //
  // Guarded for the injectable Tone mock, which may not implement Vibrato — then
  // sources fall back to connecting straight to reverb and setVibrato() no-ops.
  const vibrato =
    typeof Tone.Vibrato === 'function'
      ? new Tone.Vibrato({ frequency: 5.5, depth: 0, maxDelay: 0.01 })
      : null
  if (vibrato) vibrato.connect(reverb)

  // ── synth voice pool (Karplus-Strong, PluckSynth) ────────────────────────────
  // Pool has `polyphony × VOICES_PER_NOTE` raw voices so that chords (each
  // needing 3 voices) still get their full triple-course allocation.
  const poolSize = polyphony * VOICES_PER_NOTE
  const voices = Array.from({ length: poolSize }, () => {
    const g = new Tone.Gain(0)
    g.connect(vibrato ?? reverb)
    // Karplus-Strong qanun timbre: long resonance, warm dampening.
    const synth = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: KS_DAMPENING,
      resonance: KS_RESONANCE
    })
    synth.connect(g)
    return { synth, gain: g }
  })

  // ── sampler voice (Tone.Sampler with subtle Chorus) ──────────────────────────
  // Chain: sampler → chorus → Vibrato → reverb → sumBus.
  const chorus = new Tone.Chorus(CHORUS_FREQUENCY, CHORUS_DELAY_TIME, CHORUS_DEPTH)
  chorus.wet.value = CHORUS_WET
  chorus.connect(vibrato ?? reverb)
  // Chorus needs .start() to activate its LFO. Call it immediately — it's
  // internal DSP, no audio-context unlock required.
  chorus.start()

  let sampleLoaded = false

  const sampler = new Tone.Sampler({
    urls: QANUN_SAMPLE_URLS,
    baseUrl: QANUN_SAMPLE_BASE_URL,
    onload: () => {
      sampleLoaded = true
    }
  })
  sampler.connect(chorus)

  // ── sound-source state ────────────────────────────────────────────────────────
  let currentSource: SoundSource = 'sample'

  // ── shared state ─────────────────────────────────────────────────────────────
  // Round-robin cursor — tracks the last allocated voice slot.
  let voiceIndex = -1
  let started = false

  // ── rashsh state ────────────────────────────────────────────────────────────
  interface LoopHandle { start(t: number): void; stop(): void; dispose(): void }
  let activeLoop: LoopHandle | null = null

  // Vibrato state lives in the Vibrato node (vibrato.depth/frequency), driven by
  // the gesture layer via setVibrato().

  // ── internal helpers ────────────────────────────────────────────────────────

  /** Allocate the next voice from the pool (round-robin). */
  const allocVoice = () => {
    voiceIndex = nextVoiceIndex(voiceIndex < 0 ? voices.length - 1 : voiceIndex, voices.length)
    return voices[voiceIndex]
  }

  /** Fire a single raw attack on one synth voice (used by both pluck and rashsh). */
  const fireSynthVoice = (
    freqHz: number,
    gainValue: number,
    time?: number
  ): void => {
    const v = allocVoice()
    v.gain.gain.rampTo(gainValue, VOICE_GAIN_RAMP)
    v.synth.triggerAttack(freqHz, time)
  }

  /**
   * Fire a single attack through whichever voice is active.
   * - If soundSource === 'sample' AND sampler is loaded → use sampler.
   * - Otherwise → fall back to synth.
   */
  const fireVoice = (
    freqHz: number,
    gainValue: number,
    time?: number
  ): void => {
    if (currentSource === 'sample' && sampleLoaded) {
      sampler.triggerAttack(freqHz, time, gainValue)
    } else {
      fireSynthVoice(freqHz, gainValue, time)
    }
  }

  // ── public methods ──────────────────────────────────────────────────────────

  const start = async (): Promise<void> => {
    if (started) return
    await Tone.start()
    started = true
  }

  /**
   * Pluck a note: fires one voice per COURSE_CENTS offset (triple-course bloom).
   * For the sampler path we fire 3 separate triggerAttacks at detuned frequencies
   * so the shimmer is preserved; for the synth path we use the original voice pool.
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
   * Start rashsh sustain: repeatedly re-trigger the note at RASHSH_HZ (~10 Hz)
   * with slight velocity jitter, until holdStop() is called.
   * Only one hold is active at a time (calling again replaces the previous).
   *
   * `immediate` (default true): whether to fire an initial pluck attack.
   * Pass `false` when the note was already attacked (e.g. pointer-down already
   * called pluck()) to avoid a double-attack.
   */
  const holdStart = ({ freqHz, velocity, immediate = true }: { freqHz: number; velocity: number; immediate?: boolean }): void => {
    holdStop() // cancel any previous hold
    if (!Number.isFinite(freqHz) || freqHz <= 0) return

    // Immediate first attack (skip when caller already plucked the note).
    if (immediate) pluck({ freqHz, velocity })

    // Tone.Transport must be running for Tone.Loop to fire.
    Tone.Transport.start()

    activeLoop = new Tone.Loop((time: number) => {
      // Re-pluck the full course with slight velocity jitter so the tremolo
      // doesn't sound mechanical. Vibrato (if any) is applied independently by
      // the Vibrato node in the output chain, so a ringing note bends without
      // re-plucking.
      const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
      const v = clamp01(velocity + jitter)
      for (const freq of detunedFreqs(freqHz, [...COURSE_CENTS])) {
        fireVoice(freq, velocityCurve(v), time)
      }
    }, RASHSH_INTERVAL)

    activeLoop.start(0)
  }

  /**
   * Alternating two-string hold (rashsh trill between adjacent courses).
   * Behaves like holdStart() but the rashsh loop cycles through `freqs` in
   * order — one entry per tick (`freqs[tickCount % freqs.length]`), starting
   * at `freqs[0]`. Callers pass `[higherFreqHz, lowerFreqHz]` so the higher
   * note sounds first.
   *
   * Like holdStart(): cancels any previous hold (single active loop) and starts
   * Tone.Transport. No initial `immediate` pluck — the caller has already
   * plucked. Non-finite entries are skipped per-tick.
   *
   * Unlike holdStart's single-note rashsh (RASHSH_HZ ≈ 10 Hz), the alternation
   * ticks at the slower ALTERNATE_HZ so each pitch sounds long enough to be
   * heard as a distinct back-and-forth rather than a blurred unison.
   */
  const holdAlternate = ({ freqs, velocity }: { freqs: number[]; velocity: number }): void => {
    holdStop() // single active loop
    if (freqs.length === 0) return

    // Tone.Transport must be running for Tone.Loop to fire.
    Tone.Transport.start()

    let tickCount = 0
    activeLoop = new Tone.Loop((time: number) => {
      const freqHz = freqs[tickCount % freqs.length]
      tickCount++
      if (!Number.isFinite(freqHz) || freqHz <= 0) return
      // Same velocity jitter as holdStart's loop, cycling the frequency.
      const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
      const v = clamp01(velocity + jitter)
      for (const freq of detunedFreqs(freqHz, [...COURSE_CENTS])) {
        fireVoice(freq, velocityCurve(v), time)
      }
      // ALTERNATE_INTERVAL (the calibratable alternation rate) is slower than
      // the single-note rashsh so each of the two pitches sounds ~0.18 s and
      // the two are individually audible as a clear back-and-forth.
    }, ALTERNATE_INTERVAL)

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
    // Vibrato depth is owned entirely by setVibrato() (the gesture layer sets it
    // to 0 when there's no wave), so holdStop() does NOT touch the Vibrato node.
  }

  /**
   * Set the vibrato applied to everything in the output chain (both the sample
   * and synth voices, ringing AND tremolo). `cents` is the bend amount, clamped
   * to [0, MAX_VIBRATO_CENTS] then mapped to the Vibrato node's normal-range
   * depth; `rateHz` (optional) the modulation rate in Hz. `cents === 0` ⇒
   * depth 0 ⇒ no audible vibrato. Safe no-op when the Vibrato node is absent
   * (e.g. the injectable Tone mock). Driven each frame by the gesture/mouse
   * layer.
   */
  const setVibrato = ({ cents, rateHz }: { cents: number; rateHz?: number }): void => {
    if (!vibrato) return
    const peak = Math.max(0, Math.min(MAX_VIBRATO_CENTS, cents))
    // Map cents → normal-range depth: 0 cents → 0 (inaudible), full → 0.22.
    // The gentle 0.22 factor keeps the vibrato subtle (a full wave bends only
    // ~0.22 of the Vibrato node's range, not half).
    vibrato.depth.value = clamp01((peak / MAX_VIBRATO_CENTS) * 0.22)
    if (rateHz && rateHz > 0) vibrato.frequency.value = rateHz
  }

  /**
   * Trill: finite upper-neighbor burst.
   * Pattern: principal, neighbor, principal, neighbor, … (cycles pairs), then principal.
   * Each attack = triple-course pluck at a scheduled time.
   * cycles defaults to 4 → 9 attacks over ~1.14 s (9 × 1/7 s).
   */
  const trill = ({
    freqHz,
    neighborHz,
    velocity,
    cycles = TRILL_DEFAULT_CYCLES
  }: {
    freqHz: number
    neighborHz: number
    velocity: number
    cycles?: number
  }): void => {
    if (!Number.isFinite(freqHz) || freqHz <= 0) return
    if (!Number.isFinite(neighborHz) || neighborHz <= 0) return
    const t0 = Tone.now()
    const totalAttacks = cycles * 2 + 1  // p n p n … p
    for (let k = 0; k < totalAttacks; k++) {
      const isPrincipal = k % 2 === 0
      const hz = isPrincipal ? freqHz : neighborHz
      const time = t0 + k * TRILL_INTERVAL
      pluck({ freqHz: hz, velocity, time })
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

  const setSoundSource = (source: SoundSource): void => {
    currentSource = source
  }

  const dispose = (): void => {
    holdStop()
    voices.forEach((v) => {
      v.synth.dispose()
      v.gain.dispose()
    })
    vibrato?.dispose()
    sampler.dispose()
    chorus.dispose()
    reverb.dispose()
    sumBus.dispose()
    limiter?.dispose()
  }

  const getSampleRate = (): number => Tone.getContext().sampleRate

  /**
   * Returns the FINAL audible node's output for the recording tap, so
   * recordings match what's heard: the limiter's output when present, else
   * sumBus (when the injectable Tone mock has no Limiter). Captures exactly
   * what the user hears (after reverb + chorus + brick-wall limiting).
   */
  const getRecorderTap = (): AudioNode =>
    (limiter ?? sumBus).output as unknown as AudioNode

  return {
    start,
    dispose,
    pluck,
    holdStart,
    holdAlternate,
    holdStop,
    setVibrato,
    trill,
    setReverbEnabled,
    setReverbWet,
    setReverbSize,
    getSampleRate,
    getRecorderTap,
    setSoundSource,
    get sumBus() {
      return sumBus as unknown as Gain
    },
    get isStarted() {
      return started
    },
    get soundSource() {
      return currentSource
    },
    get isSampleLoaded() {
      return sampleLoaded
    }
  }
}

// Re-export for callers that attach practice/recorder taps later (P4).
export type { ToneAudioNode }
