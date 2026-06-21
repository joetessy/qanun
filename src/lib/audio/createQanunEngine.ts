/// <reference types="vite/client" />
import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
import { clamp01 } from '../music/clamp01'
import { reverbSizeToParams } from './reverbSize'
import { velocityCurve } from './velocityCurve'
import { detunedFreqs } from './detuneCluster'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

// The audio engine is a long-lived singleton (cached in a hook ref for the tab's
// lifetime), so plain HMR would leave a STALE engine running old code — you'd see
// new visuals but hear the old audio. Self-accept and force a full page reload
// whenever this file changes in dev, so an engine edit always takes effect. No-op
// in production / tests (import.meta.hot is undefined there).
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())

// Per-course plucked-string engine. The voice is a Tone.Sampler playing the
// recorded qanun samples — the only sound source. Strikes issued before the
// samples finish loading are dropped (a beat of silence on first launch), never
// substituted with a synth.
//
// Signal chain (sumBus → limiter → softClip → destination; limiter brick-walls
// at -1 dBFS and the soft-clip caps any transient, so dense plucks + rashsh +
// reverb can't clip):
//   Sampler → chorus (triple-course shimmer) → reverb → sumBus
//
// Core features:
//   • Triple-course bloom: each pluck fires 3 detuned sampler attacks (±4 cents).
//   • Body reverb on by default (wet ≈ 0.28).
//   • Rashsh hold: a continuous loop re-strikes a single held course at ~9 Hz.
//   • Two-note trill: alternating attacks hi-lo-hi-lo on the SAME persistent
//     clock as the single rashsh (one steady strike grid — see the hold state
//     block for why sharing the clock is what keeps transitions clean); each
//     string rings out naturally until struck again. Strikes route through
//     fireVoice, so they all share the main sampler.

export interface QanunEngineOptions {
  Tone?: typeof ToneNamespace // injectable for tests (see createDrone.ts)
  fx?: Partial<{ reverbEnabled: boolean; reverbWet: number; reverbSize: ReverbSize }>
}

export interface QanunEngine {
  start: () => Promise<void>
  dispose: () => void
  pluck: (args: { freqHz: number; velocity: number; time?: number; bloom?: boolean }) => void
  holdStart: (args: { freqHz: number; velocity: number; immediate?: boolean }) => void
  holdAlternate: (args: { freqs: number[]; velocity: number }) => void
  holdStop: () => void
  setTremoloHz: (hz: number) => void
  setReverbEnabled: (enabled: boolean) => void
  setReverbWet: (wet: number) => void
  setReverbSize: (size: ReverbSize) => void
  getSampleRate: () => number
  getRecorderTap: () => AudioNode
  readonly sumBus: Gain
  readonly isStarted: boolean
  readonly isSampleLoaded: boolean
}

// ─── constants ────────────────────────────────────────────────────────────────

/** Triple-course cent offsets — one attack per string in the unison course. */
const COURSE_CENTS = [-4, 0, 4] as const

/** Default rashsh tremolo rate in Hz (~10 picks/s — a brisk Arabic tremolo).
 *  Runtime-tunable via setTremoloHz (the tune drawer's tremolo slider); both
 *  hold shapes — single-note rashsh and the two-note trill — ride this one
 *  shared pulse, so retuning it never changes their relationship. */
export const DEFAULT_TREMOLO_HZ = 10

/** setTremoloHz clamp. Below ~6 Hz the re-strikes read as separate plucks, not
 *  a tremolo; above ~16 Hz strikes start to fuse on the ~1.5 s ring (the trill
 *  pair blurs toward a continuous dyad — see TRILL_PULSE_MULT). */
export const TREMOLO_HZ_MIN = 6
export const TREMOLO_HZ_MAX = 16

/**
 * Two-note trill pulse multiplier. The alternation ticks at the SAME pulse as
 * the single-string trill (1× the rashsh rate): one pluck-weight note per tick,
 * hi-lo-hi-lo — a played trill figure, the same thing as alternating fast
 * manual plucks between the two strings (the reference sound). Tuned by ear
 * across both failure modes:
 *   - 2× (each string at the full rashsh rate) doubles the attacks/s, far
 *     faster than the ~1.5 s ring decays on either string — the pair fuses into
 *     a continuous octave dyad and reads as UNISON, not alternation.
 *   - 1× with the old soft single-voice strikes read as a sparse, quiet seesaw —
 *     but that was the strike weight, not the rate (fixed below: each tick now
 *     blooms at near-pluck velocity).
 * The base rate itself is the user's to tune (setTremoloHz) — keep each note
 * discrete enough to parse before ever reaching for 2×.
 */
const TRILL_PULSE_MULT = 1

/**
 * Per-strike velocity scale for EVERY hold strike — single-note rashsh and the
 * two-note trill alike. Pushed ABOVE 1 so each bloomed strike lands near a real
 * pluck's level rather than the soft SUSTAIN_VELOCITY the hold is issued at —
 * both tremolo shapes kept reading as "much quieter than the pluck" otherwise.
 * The master limiter + soft-clip brick-wall any summed peaks, so a hot
 * per-strike level buys presence without letting the sum run away.
 * Effective velocity ≈ SUSTAIN_VELOCITY × this.
 */
const HOLD_VELOCITY_SCALE = 1.2

/**
 * Forward-only timing slop per hold strike (seconds). Real tremolo strikes —
 * one hand re-picking a string or two alternating — never land on a perfect
 * grid; a few ms of humanization keeps both shapes from sounding mechanical.
 * Strictly positive so nothing schedules in the past.
 */
const TRILL_TIME_JITTER_SEC = 0.006

/**
 * Velocity variation range for rashsh re-triggers (± this fraction of base).
 * Keeps the tremolo from sounding mechanical.
 */
const RASHSH_VELOCITY_JITTER = 0.12

// Default reverb: subtle "body" resonance (medium room, low wet).
const DEFAULT_REVERB_WET = 0.28
const DEFAULT_REVERB_SIZE: ReverbSize = 'medium'

// Subtle chorus on the sampled path to reinforce the triple-course shimmer.
const CHORUS_FREQUENCY = 1.5   // Hz — slow LFO, avoids obvious wobble
const CHORUS_DELAY_TIME = 3.5  // ms — moderate width
const CHORUS_DEPTH = 0.15      // low depth for subtlety
const CHORUS_WET = 0.35        // blend: mostly dry, gentle shimmer

const FX_WET_RAMP = 0.08

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

/**
 * Route Web Audio output to the iOS "playback" audio-session category.
 *
 * By default iOS puts Web Audio in the "ambient" category, which is silenced by
 * the hardware mute switch and played at *ringer* (not media) volume — the usual
 * reason a correctly-unlocked instrument is dead silent on an iPhone even though
 * it works on desktop. "playback" routes output to the media channel: it ignores
 * the mute switch and follows the volume buttons' media level.
 *
 * Feature-detected via the Audio Session API (Safari 16.4+); a harmless no-op on
 * browsers that don't expose `navigator.audioSession` (desktop, Android Chrome).
 */
const setPlaybackAudioSession = (): void => {
  const nav = navigator as Navigator & { audioSession?: { type?: string } }
  if (!nav.audioSession || nav.audioSession.type === 'playback') return
  try {
    nav.audioSession.type = 'playback'
  } catch {
    // Property may be read-only / throw on some engines — ignore.
  }
}

// ─── factory ──────────────────────────────────────────────────────────────────

export const createQanunEngine = ({
  Tone = ToneNamespace,
  fx
}: QanunEngineOptions = {}): QanunEngine => {
  // Set the playback session BEFORE the first Tone node creates the AudioContext,
  // so the context comes up on the media route from the start (iOS — see helper).
  setPlaybackAudioSession()
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

  // ── shared state ─────────────────────────────────────────────────────────────
  let started = false

  // ── hold (sustain) state — ONE continuous Tone.Clock drives BOTH sustain
  // shapes: one held course → single-note rashsh re-strikes; two held → the
  // alternating two-note trill (hi-lo-hi-lo). The single shared clock is the
  // point, not a convenience: the old separate rashsh/trill clocks tore one
  // loop down and started the other on every 1↔2 transition, and a fresh
  // Tone.Clock fires its first tick AT start — so the trill's opening strike
  // landed anywhere from 0–111 ms after the rashsh's last one, decided purely
  // by when the second finger happened to pinch. Entries read as flams or
  // near-unison, and pinch-detection flapping ({A} ↔ {A,B}) multiplied the
  // double-fires. One persistent clock keeps every strike on the same steady
  // grid; transitions only change WHAT the next tick plays. Runs on its own
  // Tone.Clock (NOT the Transport) so the tremolo rate stays a fixed Hz,
  // independent of the metronome's Transport BPM. ──
  interface ClockHandle { start(): void; stop(): void; dispose(): void; frequency: { value: number } }
  let holdLoop: ClockHandle | null = null
  let heldFreqs: number[] = []   // [one] = single rashsh, [hi, lo] = trill
  let heldVelocity = 0.6
  let holdTick = 0               // alternation cursor; resets ONLY on a held-COUNT change
  let tremoloHz = DEFAULT_TREMOLO_HZ // shared hold pulse, user-tunable via setTremoloHz

  /** The hold clock's rate for the CURRENT held count (trill may run a multiple). */
  const holdRateHz = (): number =>
    heldFreqs.length >= 2 ? tremoloHz * TRILL_PULSE_MULT : tremoloHz

  // ── internal helpers ────────────────────────────────────────────────────────

  /**
   * Fire a single sampler attack. Strikes issued before the samples finish
   * loading are dropped — there is no synth fallback, so the worst case is a
   * beat of silence on the very first launch rather than a wrong-timbre note.
   */
  const fireVoice = (
    freqHz: number,
    gainValue: number,
    time?: number
  ): void => {
    if (!sampleLoaded) return
    sampler.triggerAttack(freqHz, time, gainValue)
  }

  // ── public methods ──────────────────────────────────────────────────────────

  const start = async (): Promise<void> => {
    if (started) return
    // Re-assert the media route on the unlock gesture too — covers the case where
    // the context was created before the session was set (iOS — see helper).
    setPlaybackAudioSession()
    await Tone.start()
    started = true
  }

  /**
   * Pluck a note: fires one sampler attack per COURSE_CENTS offset (triple-course
   * bloom) — 3 separate triggerAttacks at detuned frequencies so the unison-course
   * shimmer is preserved.
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
    // Triple-course bloom (3 detuned voices) — the default for EVERY melodic
    // strike, strum/glide sweeps included: a single-voice sweep step read thin
    // next to a pluck, and the master limiter + soft-clip already make the sum
    // clip-proof. false fires 1 un-detuned voice; no melodic caller passes it
    // today (the rashsh loop strikes single voices directly), kept as the
    // engine's plain-strike option.
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
   * Reconcile the sustain to the given held set — the single engine behind
   * holdStart/holdAlternate/holdStop. 0 freqs tears the clock down; otherwise
   * ONE persistent clock keeps ticking and every tick reads the CURRENT set:
   *   1 freq  → rashsh: the held note re-struck every tick.
   *   2 freqs → trill: alternating strikes, hi-lo-hi-lo.
   * Either way each tick is the SAME strike as a pluck — the full triple-course
   * BLOOM (3 detuned voices) at near-pluck velocity (HOLD_VELOCITY_SCALE) with
   * a few ms of humanization (TRILL_TIME_JITTER_SEC) — so every note lands with
   * a pluck's body and shimmer, single-note tremolo included.
   * The alternation cursor resets ONLY when the held COUNT changes (a note
   * added/removed), so the next tick deterministically leads with freqs[0] —
   * the higher note, by the callers' ordering — no matter which finger pinched
   * first or where the old phase stood. A pitch slide with the same count keeps
   * the phase, so a jittering held course can't restart the figure. And because
   * the clock itself never restarts mid-hold, 1↔2 transitions stay on the same
   * strike grid: no flam against the previous shape's last strike, no swallowed
   * or doubled notes. Nothing is silenced: every struck string rings out
   * naturally until its next strike (the teardown leaves gates open too).
   */
  const setHeld = ({ freqs, velocity }: { freqs: number[]; velocity?: number }): void => {
    const valid = freqs.filter((f) => Number.isFinite(f) && f > 0)
    if (velocity !== undefined) heldVelocity = velocity

    if (valid.length === 0) {
      // Nothing held — tear the loop down; the last strikes ring out naturally.
      heldFreqs = []
      if (holdLoop) {
        holdLoop.stop()
        holdLoop.dispose()
        holdLoop = null
      }
      return
    }

    if (valid.length !== heldFreqs.length) holdTick = 0 // count change → next tick leads with freqs[0]
    heldFreqs = valid

    // The trill may pulse at a multiple of the single rashsh (TRILL_PULSE_MULT).
    // Retuning the RUNNING clock's frequency preserves tick continuity (that is
    // what Tone's TickSignal is for), so a mid-hold rate change can't stutter
    // the grid the way a stop/start would.
    const rateHz = holdRateHz()
    if (holdLoop) {
      holdLoop.frequency.value = rateHz
      return
    }

    holdLoop = new Tone.Clock((time: number) => {
      const struck = heldFreqs
      if (struck.length === 0) return
      const idx = holdTick % struck.length
      holdTick++
      // Slight velocity jitter so the tremolo isn't mechanical.
      const jitter = (Math.random() * 2 - 1) * RASHSH_VELOCITY_JITTER
      // Every hold strike — single rashsh or trill alternation — is the SAME
      // event as a pluck: the full triple-course bloom at near-pluck velocity.
      // (The voice budget is identical to the trill's 9 ticks/s × 3 voices,
      // which the limiter + soft-clip already absorb; thinning the single-note
      // strike to one voice only made one-finger tremolo read soft and distant
      // next to a pluck.)
      const v = clamp01(heldVelocity * HOLD_VELOCITY_SCALE + jitter)
      const gainValue = velocityCurve(v)
      // Forward-only slop — real strikes never land on a perfect grid.
      const t = time + Math.random() * TRILL_TIME_JITTER_SEC
      for (const freq of detunedFreqs(struck[idx], COURSE_CENTS)) {
        fireVoice(freq, gainValue, t)
      }
    }, rateHz)
    holdLoop.start() // a fresh Tone.Clock fires its first tick AT start — the hold sounds immediately
  }

  /**
   * Start a single-note rashsh hold. `immediate` (default true) fires an initial
   * pluck; pass false when the note was already plucked (e.g. pointer-down).
   * Dropping from a two-note trill to one held note rides the same shared
   * clock, so the surviving note keeps the trill's strike grid.
   */
  const holdStart = ({ freqHz, velocity, immediate = true }: { freqHz: number; velocity: number; immediate?: boolean }): void => {
    if (!Number.isFinite(freqHz) || freqHz <= 0) return
    if (immediate) pluck({ freqHz, velocity })
    setHeld({ freqs: [freqHz], velocity })
  }

  /**
   * Hold two courses at once → the alternating trill (caller passes
   * [higher, lower]; whenever the pair forms, the alternation re-leads with the
   * higher note). Rides the SAME persistent clock as the single rashsh, so the
   * trill sounds identical no matter which finger pinched first or how the two
   * pinches were timed. With only one valid note this IS the single rashsh;
   * with none it stops the hold. 3+ valid notes keep the top two of the
   * caller's higher-first ordering.
   */
  const holdAlternate = ({ freqs, velocity }: { freqs: number[]; velocity: number }): void => {
    setHeld({ freqs: freqs.filter((f) => Number.isFinite(f) && f > 0).slice(0, 2), velocity })
  }

  /**
   * Stop all sustain — the single rashsh and the two-note trill share one clock.
   */
  const holdStop = (): void => {
    setHeld({ freqs: [] })
  }

  /**
   * Retune the shared tremolo pulse (both hold shapes ride it — see
   * DEFAULT_TREMOLO_HZ). Clamped to TREMOLO_HZ_MIN..MAX. A running hold clock
   * retunes IN PLACE (tick-continuous, like a pitch slide), so dragging the
   * slider mid-tremolo can't stutter or restart the strike grid.
   */
  const setTremoloHz = (hz: number): void => {
    if (!Number.isFinite(hz)) return
    tremoloHz = Math.min(TREMOLO_HZ_MAX, Math.max(TREMOLO_HZ_MIN, hz))
    if (holdLoop) holdLoop.frequency.value = holdRateHz()
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
    setTremoloHz,
    setReverbEnabled,
    setReverbWet,
    setReverbSize,
    getSampleRate,
    getRecorderTap,
    get sumBus() {
      return sumBus as unknown as Gain
    },
    get isStarted() {
      return started
    },
    get isSampleLoaded() {
      return sampleLoaded
    }
  }
}

// Re-export for callers that attach practice/recorder taps later (P4).
export type { ToneAudioNode }
