/// <reference types="vite/client" />
import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
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
//   • Rashsh hold: a continuous loop re-strikes a single held course at ~10 Hz.
//   • Two-note trill: a DEDICATED engine — two independent voices alternating
//     attacks hi-lo-hi-lo on the same 16th-note pulse; each string rings out
//     naturally until struck again (like two real strings plucked in turn).
//     Each voice has its own Sampler (real qanun timbre) with a brief
//     Karplus-Strong fallback while samples load (see startTrill).
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
  // tremolo). Two simultaneous holds route to the dedicated trill engine below. ──
  interface LoopHandle { start(t: number): void; stop(): void; dispose(): void }
  let rashshLoop: LoopHandle | null = null
  let heldFreqs: number[] = []
  let heldVelocity = 0.6
  let rashshTick = 0

  // ── dedicated two-note trill ──────────────────────────────────────────────────
  // Two held notes get their OWN engine (not the rashsh loop): two independent
  // voices, one per octave, alternately struck hi→lo→hi→lo at the 16th-note
  // pulse. Nothing is cut — each string rings out naturally until struck again,
  // like two real strings plucked in turn. Each voice carries its OWN small
  // Sampler (so each octave has the real qanun timbre on its own output) plus a
  // Karplus-Strong fallback while samples load. The per-voice gain carries the
  // strike level.
  interface TrillVoice {
    sampler: { triggerAttack: (f: number, t?: number, v?: number) => void; dispose: () => void }
    synth: { triggerAttack: (f: number, t?: number) => void; dispose: () => void }
    gain: Gain
  }
  let trillVoices: [TrillVoice, TrillVoice] | null = null
  // Both trill samplers must be ready before the trill switches to the sampled
  // timbre, so the two octaves never sound mismatched (one sample, one synth).
  let trillSamplersLoaded = 0
  let trillLoop: LoopHandle | null = null
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
    // Pre-warm the dedicated trill voices so their samplers are loaded (from
    // browser cache) well before the first two-note trill is played.
    ensureTrillVoices()
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
      Tone.Transport.start()
      rashshTick = 0
      rashshLoop = new Tone.Loop((time: number) => {
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
      }, RASHSH_INTERVAL)
      rashshLoop.start(0)
    }
  }

  // ── dedicated two-note trill engine ──────────────────────────────────────────

  /**
   * Lazily build the two gated trill voices (one per octave): each is its own
   * Sampler (the real qanun timbre) + a Karplus-Strong fallback, both feeding the
   * voice's gate gain → reverb. The sample URLs were already fetched by the main
   * sampler, so these load from browser cache — typically ready in well under a
   * second; start() pre-warms them so the first trill is already sampled.
   */
  const ensureTrillVoices = (): [TrillVoice, TrillVoice] => {
    if (trillVoices) return trillVoices
    const make = (): TrillVoice => {
      const gain = new Tone.Gain(0)
      // Through the shared chorus so the trill matches the main sampled path's
      // shimmer exactly (sampler → gate → chorus → reverb).
      gain.connect(chorus)
      const voiceSampler = new Tone.Sampler({
        urls: QANUN_SAMPLE_URLS,
        baseUrl: QANUN_SAMPLE_BASE_URL,
        onload: () => {
          trillSamplersLoaded++
        }
      })
      voiceSampler.connect(gain)
      const synth = new Tone.PluckSynth({ attackNoise: 1, dampening: KS_DAMPENING, resonance: KS_RESONANCE })
      synth.connect(gain)
      return { sampler: voiceSampler, synth, gain }
    }
    trillVoices = [make(), make()]
    return trillVoices
  }

  /**
   * Start (or retune) the two-note trill: alternating 16th-note attacks — hi,
   * lo, hi, lo — always starting on the high note. Each tick strikes ONE
   * dedicated voice; nothing is silenced, so both strings ring out naturally
   * until their next strike, like two real strings plucked in turn. Calling
   * again while running just retunes (slide) without restarting the loop, so
   * the phase never stutters.
   */
  const startTrill = (hiHz: number, loHz: number, velocity: number): void => {
    trillFreqs = [hiHz, loHz]
    trillVelocity = velocity
    if (trillLoop) return
    const pair = ensureTrillVoices()
    Tone.Transport.start()
    trillTick = 0
    trillLoop = new Tone.Loop((time: number) => {
      const idx = trillTick % 2
      trillTick++
      const active = pair[idx]
      const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
      const level = velocityCurve(clamp01(trillVelocity + jitter))
      // Two INDEPENDENT strings: the gate only carries the strike level — the
      // other octave is never closed, so each string rings out naturally until
      // it is struck again (the alternation lives in the attacks, hi-lo-hi-lo,
      // exactly like two real strings plucked in turn).
      active.gain.gain.rampTo(level, VOICE_GAIN_RAMP, time)
      // Sampled qanun timbre once both voice-samplers are ready (and the engine
      // is in 'sample' mode); Karplus-Strong only as the brief loading fallback.
      if (currentSource === 'sample' && trillSamplersLoaded >= 2) {
        active.sampler.triggerAttack(trillFreqs[idx], time, 1)
      } else {
        active.synth.triggerAttack(trillFreqs[idx], time)
      }
    }, RASHSH_INTERVAL)
    trillLoop.start(0)
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
    trillVoices?.forEach((v) => {
      v.sampler.dispose()
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
