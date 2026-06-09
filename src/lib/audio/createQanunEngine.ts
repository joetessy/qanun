import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
import { reverbSizeToParams } from './reverbSize'
import { velocityCurve } from './velocityCurve'
import { nextVoiceIndex } from './voicePool'

// Per-course plucked-string engine. P1 voice = Tone.PluckSynth (Karplus-Strong);
// P2 swaps in a Tone.Sampler behind this same `pluck()` interface. A pool of
// monophonic voices gives polyphony for chords + fast runs (voice stealing).
export interface QanunEngineOptions {
  Tone?: typeof ToneNamespace // injectable for tests (see createDrone.ts)
  polyphony?: number
  fx?: Partial<{ reverbEnabled: boolean; reverbWet: number; reverbSize: ReverbSize }>
}

export interface QanunEngine {
  start: () => Promise<void>
  dispose: () => void
  pluck: (args: { freqHz: number; velocity: number; time?: number }) => void
  setReverbEnabled: (enabled: boolean) => void
  setReverbWet: (wet: number) => void
  setReverbSize: (size: ReverbSize) => void
  getSampleRate: () => number
  readonly sumBus: Gain
  readonly isStarted: boolean
}

const FX_WET_RAMP = 0.08
const VOICE_GAIN_RAMP = 0.01
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

export const createQanunEngine = ({
  Tone = ToneNamespace,
  polyphony = 16,
  fx
}: QanunEngineOptions = {}): QanunEngine => {
  let reverbEnabled = fx?.reverbEnabled ?? true
  let reverbWet = fx?.reverbWet ?? 0.3
  let reverbSize: ReverbSize = fx?.reverbSize ?? 'medium'

  // Chain: voice[i] → voiceGain[i] → reverb → sumBus → destination.
  const sumBus = new Tone.Gain(1).toDestination()
  const params = reverbSizeToParams(reverbSize)
  const reverb = new Tone.Reverb({
    decay: params.decaySec,
    preDelay: params.preDelaySec,
    wet: reverbEnabled ? clamp01(reverbWet) : 0
  })
  reverb.connect(sumBus)

  const voices = Array.from({ length: polyphony }, () => {
    const g = new Tone.Gain(0)
    g.connect(reverb)
    const synth = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.9 })
    synth.connect(g)
    return { synth, gain: g }
  })

  let voiceIndex = -1
  let started = false

  const start = async (): Promise<void> => {
    if (started) return
    await Tone.start()
    started = true
  }

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
    voiceIndex = nextVoiceIndex(voiceIndex < 0 ? voices.length - 1 : voiceIndex, voices.length)
    const v = voices[voiceIndex]
    v.gain.gain.rampTo(velocityCurve(clamp01(velocity)), VOICE_GAIN_RAMP)
    // PluckSynth accepts a frequency in Hz as the note — quarter-tones come free.
    v.synth.triggerAttack(freqHz, time)
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
