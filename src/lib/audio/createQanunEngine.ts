/// <reference types="vite/client" />
import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
import { clamp01 } from '../music/clamp01'
import { reverbSizeToParams } from './reverbSize'
import { velocityCurve } from './velocityCurve'
import { nextVoiceIndex } from './voicePool'
import { detunedFreqs } from './detuneCluster'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

// The audio engine is a long-lived singleton (cached in a hook ref for the tab's
// lifetime), so plain HMR would leave a STALE engine running old code — you'd see
// new visuals but hear the old audio. Self-accept and force a full page reload
// whenever this file changes in dev, so an engine edit always takes effect. No-op
// in production / tests (import.meta.hot is undefined there).
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())

// Per-course plucked-string engine. P1 voice = Tone.PluckSynth (Karplus-Strong);
// P2 adds a Tone.Sampler behind the same `pluck()` interface.
//
// Sound source routing:
//   'sample' (default) — uses Tone.Sampler once loaded; falls back to synth while loading.
//   'synth' — always uses the PluckSynth pool.
//
// Signal chain (sumBus → limiter → softClip → destination; limiter brick-walls
// at -1 dBFS and the soft-clip caps any transient, so dense plucks + rashsh +
// reverb can't clip):
//   Sampler → chorus (triple-course shimmer for sampled path) → reverb → sumBus
//   PluckSynth voices → voiceGain → reverb → sumBus
//
// Core features:
//   • Triple-course bloom: each pluck fires 3 detuned voices (±4 cents).
//   • Longer ring: resonance ↑ to 0.97, dampening 3500 Hz for warmer tone.
//   • Body reverb on by default (wet ≈ 0.28).
//   • Rashsh hold: a continuous loop re-strikes a single held course at ~9 Hz.
//   • Two-note trill: two interleaved "hands" — alternating attacks hi-lo-hi-lo
//     at TWICE the rashsh pulse, so each string is struck at the full
//     single-string tremolo rate; each string rings out naturally until struck
//     again. Strikes route through fireVoice, so they share the main sampler
//     (with the Karplus-Strong fallback while samples load).
export type SoundSource = 'sample' | 'synth'

export interface QanunEngineOptions {
  Tone?: typeof ToneNamespace // injectable for tests (see createDrone.ts)
  polyphony?: number           // logical note polyphony (pool = polyphony × 3)
  fx?: Partial<{ reverbEnabled: boolean; reverbWet: number; reverbSize: ReverbSize }>
}

export interface QanunEngine {
  start: () => Promise<void>
  dispose: () => void
  pluck: (args: { freqHz: number; velocity: number; time?: number; bloom?: boolean }) => void
  holdStart: (args: { freqHz: number; velocity: number; immediate?: boolean }) => void
  holdAlternate: (args: { freqs: number[]; velocity: number }) => void
  holdStop: () => void
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

/** Rashsh tremolo rate in Hz (~9 picks/s — a brisk Arabic tremolo, eased a
 *  touch from 10 so each strike's attack reads more clearly). */
const RASHSH_HZ = 9

/**
 * Two-note trill pulse multiplier. The alternation ticks at the SAME pulse as
 * the single-string trill (1× RASHSH_HZ): one pluck-weight note per tick,
 * hi-lo-hi-lo — a played trill figure, the same thing as alternating fast
 * manual plucks between the two strings (the reference sound). Tuned by ear
 * across both failure modes:
 *   - 2× (each string at the full 9 Hz rashsh rate) lands 18 attacks/s, far
 *     faster than the ~1.5 s ring decays on either string — the pair fuses into
 *     a continuous octave dyad and reads as UNISON, not alternation.
 *   - 1× with the old soft single-voice strikes read as a sparse, quiet seesaw —
 *     but that was the strike weight, not the rate (fixed below: each tick now
 *     blooms at near-pluck velocity).
 * If 9 notes/s ever feels sluggish, ~1.33 (12 Hz) is the next stop — keep each
 * note discrete enough to parse before reaching for 2×.
 */
const TRILL_PULSE_MULT = 1

/**
 * Per-strike velocity scale for the two-note trill. Pushed ABOVE 1 so each
 * (bloomed) strike lands near a real pluck's level rather than the soft
 * SUSTAIN_VELOCITY a single-note rashsh sits at — the two-note trill kept reading
 * as "much quieter than the pluck" otherwise. The master limiter + soft-clip
 * brick-wall any summed peaks, so a hot per-strike level buys presence without
 * letting the octave dyad runaway. Effective velocity ≈ SUSTAIN_VELOCITY × this.
 */
const TRILL_VELOCITY_SCALE = 1.2

/**
 * Forward-only timing slop per trill strike (seconds). Two real hands never
 * interleave on a perfect grid; a few ms of humanization keeps the alternation
 * from sounding mechanical. Strictly positive so nothing schedules in the past.
 */
const TRILL_TIME_JITTER_SEC = 0.006

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

/** Below this magnitude the soft-clip is fully transparent (identity). */
const SOFTCLIP_KNEE = 0.9

/**
 * Builds the transfer curve for the final-stage soft-clip WaveShaper.
 *
 * Identity below ±SOFTCLIP_KNEE (so normal-level signal is untouched), then a
 * smooth tanh saturation that asymptotes toward ±1 above the knee. A
 * WaveShaperNode clamps its input index to [-1, 1], so any sample that arrives
 * above full-scale (a transient the limiter's ~3 ms attack let slip) maps to
 * curve(±1) — strictly below 1.0 — and therefore can never clip the output.
 * This is what removes the audible crunch on fast glides.
 */
export const makeSoftClipCurve = (samples = 2048): Float32Array => {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1 // -1 … 1
    const a = Math.abs(x)
    if (a <= SOFTCLIP_KNEE) {
      curve[i] = x
    } else {
      const sign = x < 0 ? -1 : 1
      const t = (a - SOFTCLIP_KNEE) / (1 - SOFTCLIP_KNEE)
      curve[i] = sign * (SOFTCLIP_KNEE + (1 - SOFTCLIP_KNEE) * Math.tanh(t))
    }
  }
  return curve
}

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
  // Both voices route through reverb → sumBus → limiter → softClip → destination.
  // sumBus runs at 0.8 for headroom; the Tone.Limiter brick-walls at
  // -1 dBFS, but its ~3 ms attack lets sharp pluck transients (and dense glide
  // bursts) slip through and clip. The softClip WaveShaper is the zero-attack
  // final safety: it instantaneously caps every sample below full-scale, so the
  // output can NEVER clip. Both are guarded for the injectable Tone mock (which
  // may implement neither); the chain is built from whatever nodes exist and the
  // last one drives the destination, so tests still work.
  const sumBus = new Tone.Gain(0.8)
  const limiter = typeof Tone.Limiter === 'function' ? new Tone.Limiter(-1) : null
  const softClip = typeof Tone.WaveShaper === 'function' ? new Tone.WaveShaper(makeSoftClipCurve()) : null
  if (softClip) softClip.oversample = '4x'
  const masterChain = [sumBus, limiter, softClip].filter((n) => n !== null) as ToneAudioNode[]
  for (let i = 0; i < masterChain.length - 1; i++) masterChain[i].connect(masterChain[i + 1])
  const finalNode = masterChain[masterChain.length - 1]
  finalNode.toDestination()
  const params = reverbSizeToParams(reverbSize)
  const reverb = new Tone.Reverb({
    decay: params.decaySec,
    preDelay: params.preDelaySec,
    wet: reverbEnabled ? clamp01(reverbWet) : 0
  })
  reverb.connect(sumBus)

  // ── synth voice pool (Karplus-Strong, PluckSynth) ────────────────────────────
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

  // ── sampler voice (Tone.Sampler with subtle Chorus) ──────────────────────────
  // Chain: sampler → chorus → reverb → sumBus.
  const chorus = new Tone.Chorus(CHORUS_FREQUENCY, CHORUS_DELAY_TIME, CHORUS_DEPTH)
  chorus.wet.value = CHORUS_WET
  chorus.connect(reverb)
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

  // ── rashsh state — ONE continuous loop re-plucks the held course (single-note
  // tremolo). Two simultaneous holds route to the alternating trill loop below.
  // Both run on their own Tone.Clock (NOT the Transport) so the tremolo rate
  // stays a fixed Hz, independent of the metronome's Transport BPM. ──
  interface ClockHandle { start(): void; stop(): void; dispose(): void }
  let rashshLoop: ClockHandle | null = null
  let heldFreqs: number[] = []
  let heldVelocity = 0.6
  let rashshTick = 0

  // ── two-note trill — alternating attacks, hi→lo→hi→lo, one pluck-weight note
  // per tick at the single-trill pulse. Nothing is cut: each string rings out
  // naturally until struck again, like two real strings plucked in turn. Strikes
  // bloom through fireVoice (triple-course, like a pluck), sharing the main
  // sampler (Karplus-Strong fallback while loading). ──
  let trillLoop: ClockHandle | null = null
  let trillFreqs: [number, number] = [0, 0]
  let trillVelocity = 0.6
  let trillTick = 0

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
    // Ramp at the scheduled attack time (rashsh ticks arrive ~0.1 s early), so
    // the level change can't retroactively rescale a still-ringing prior note.
    v.gain.gain.rampTo(gainValue, VOICE_GAIN_RAMP, time)
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
    time,
    bloom = true
  }: {
    freqHz: number
    velocity: number
    time?: number
    // Triple-course bloom (3 detuned voices). Pass false for glide steps so a
    // fast drag across many strings fires 1 voice each instead of 3 — keeps the
    // burst from slamming the master chain (anti-clipping).
    bloom?: boolean
  }): void => {
    if (!Number.isFinite(freqHz) || freqHz <= 0) return
    const gainValue = velocityCurve(clamp01(velocity))
    const offsets = bloom ? COURSE_CENTS : [0]
    for (const freq of detunedFreqs(freqHz, offsets)) {
      fireVoice(freq, gainValue, time)
    }
  }

  /**
   * Single-note rashsh sustain: ONE continuous loop re-plucks the held note at
   * RASHSH_HZ (the 16th-note tremolo pulse). Two simultaneous holds are routed to
   * the dedicated gain-gated trill engine below (startTrill), never here.
   */
  const setHeld = ({ freqs, velocity }: { freqs: number[]; velocity?: number }): void => {
    heldFreqs = freqs.filter((f) => Number.isFinite(f) && f > 0)
    if (velocity !== undefined) heldVelocity = velocity

    if (heldFreqs.length === 0) {
      // Nothing held — tear the loop down.
      if (rashshLoop) {
        rashshLoop.stop()
        rashshLoop.dispose()
        rashshLoop = null
      }
      return
    }

    if (!rashshLoop) {
      rashshTick = 0
      rashshLoop = new Tone.Clock((time: number) => {
        if (heldFreqs.length === 0) return
        const freqHz = heldFreqs[rashshTick % heldFreqs.length]
        rashshTick++
        // Slight velocity jitter so the tremolo isn't mechanical.
        const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
        const v = clamp01(heldVelocity + jitter)
        // Single voice per strike (not the triple-course bloom): a note re-struck
        // ~10×/s rings ~1.5 s, so blooming would stack dozens of copies and slam
        // the master soft-clip.
        fireVoice(freqHz, velocityCurve(v), time)
      }, RASHSH_HZ)
      rashshLoop.start()
    }
  }

  /**
   * Start (or retune) the two-note trill — a played trill figure: alternating
   * pluck-weight notes hi, lo, hi, lo, always leading with the high note, at the
   * single-trill pulse (RASHSH_HZ × TRILL_PULSE_MULT — see that constant for why
   * faster fuses into unison). Each tick fires the full triple-course BLOOM
   * (3 detuned voices, exactly like a pluck) at near-pluck velocity
   * (TRILL_VELOCITY_SCALE) with a few ms of humanization (TRILL_TIME_JITTER_SEC)
   * — so every note lands with a pluck's body and shimmer, the same event as the
   * fast manual alternation it's meant to automate. Nothing is silenced: both
   * strings ring out naturally until their next strike. Calling again while
   * running just retunes (slide) without restarting the loop, so the phase never
   * stutters.
   */
  const startTrill = (hiHz: number, loHz: number, velocity: number): void => {
    trillFreqs = [hiHz, loHz]
    trillVelocity = velocity
    if (trillLoop) return
    trillTick = 0
    trillLoop = new Tone.Clock((time: number) => {
      const idx = trillTick % 2
      trillTick++
      const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
      const v = clamp01(trillVelocity * TRILL_VELOCITY_SCALE + jitter)
      const gainValue = velocityCurve(v)
      // Forward-only slop — two hands never interleave on a perfect grid.
      const t = time + Math.random() * TRILL_TIME_JITTER_SEC
      // Bloom each strike to the triple-course cluster (same as a pluck) for body
      // and the qanun's chorused shimmer.
      for (const freq of detunedFreqs(trillFreqs[idx], COURSE_CENTS)) {
        fireVoice(freq, gainValue, t)
      }
    }, RASHSH_HZ * TRILL_PULSE_MULT)
    trillLoop.start()
  }

  /**
   * Stop the two-note trill. The gates are left open on purpose: like real
   * strings, the last struck notes ring out naturally after release (matching
   * how the single-note rashsh ends).
   */
  const stopTrill = (): void => {
    if (trillLoop) {
      trillLoop.stop()
      trillLoop.dispose()
      trillLoop = null
    }
  }

  /**
   * Start a single-note rashsh hold. `immediate` (default true) fires an initial
   * pluck; pass false when the note was already plucked (e.g. pointer-down).
   */
  const holdStart = ({ freqHz, velocity, immediate = true }: { freqHz: number; velocity: number; immediate?: boolean }): void => {
    if (!Number.isFinite(freqHz) || freqHz <= 0) return
    stopTrill() // e.g. dropping from a two-note trill back to one held note
    if (immediate) pluck({ freqHz, velocity })
    setHeld({ freqs: [freqHz], velocity })
  }

  /**
   * Hold two courses at once → the dedicated alternating trill (caller passes
   * [higher, lower], and the trill always leads with the higher). With only one
   * valid note this falls back to the single rashsh; with none it stops all.
   */
  const holdAlternate = ({ freqs, velocity }: { freqs: number[]; velocity: number }): void => {
    const valid = freqs.filter((f) => Number.isFinite(f) && f > 0)
    if (valid.length >= 2) {
      setHeld({ freqs: [] }) // the single rashsh yields to the trill engine
      startTrill(valid[0], valid[1], velocity)
    } else if (valid.length === 1) {
      stopTrill()
      setHeld({ freqs: valid, velocity })
    } else {
      holdStop()
    }
  }

  /**
   * Stop all sustain — the single rashsh AND the two-note trill.
   */
  const holdStop = (): void => {
    stopTrill()
    setHeld({ freqs: [] })
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
    sampler.dispose()
    chorus.dispose()
    reverb.dispose()
    sumBus.dispose()
    limiter?.dispose()
    softClip?.dispose()
  }

  const getSampleRate = (): number => Tone.getContext().sampleRate

  /**
   * Returns the FINAL audible node's output for the recording tap, so recordings
   * match what's heard — the last node in the master chain (softClip when
   * present, else limiter, else sumBus for the mock). Captures exactly what the
   * user hears (after reverb + chorus + brick-wall limiting + soft-clip).
   */
  const getRecorderTap = (): AudioNode =>
    finalNode.output as unknown as AudioNode

  return {
    start,
    dispose,
    pluck,
    holdStart,
    holdAlternate,
    holdStop,
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
