import { describe, expect, it, vi } from 'vitest'
import { createQanunEngine } from './createQanunEngine'

const makeMockTone = () => {
  const triggerAttack = vi.fn()
  const voiceGainRampTo = vi.fn()
  const reverbWetRampTo = vi.fn()
  const ToneMock = {
    start: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn(() => ({ sampleRate: 48000 })),
    PluckSynth: vi.fn().mockImplementation(() => ({
      triggerAttack,
      connect: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    })),
    Gain: vi.fn().mockImplementation((v: number) => ({
      gain: { value: v, rampTo: voiceGainRampTo },
      connect: vi.fn().mockReturnThis(),
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    })),
    Reverb: vi.fn().mockImplementation(() => ({
      wet: { value: 0, rampTo: reverbWetRampTo },
      decay: 0,
      preDelay: 0,
      connect: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    }))
  }
  return { ToneMock, triggerAttack, voiceGainRampTo, reverbWetRampTo }
}

const ENGINE_ARGS = (ToneMock: unknown) => ({
  Tone: ToneMock as unknown as typeof import('tone'),
  polyphony: 4
})

describe('createQanunEngine', () => {
  it('exposes the documented surface', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (const fn of ['start', 'dispose', 'pluck', 'setReverbEnabled', 'setReverbWet', 'setReverbSize', 'getSampleRate']) {
      expect(typeof (e as unknown as Record<string, unknown>)[fn]).toBe('function')
    }
    expect(e.isStarted).toBe(false)
  })

  it('builds a pool of `polyphony` PluckSynth voices', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.PluckSynth).toHaveBeenCalledTimes(4)
  })

  it('pluck() triggers a voice at the given frequency and sets its gain from velocity', () => {
    const { ToneMock, triggerAttack, voiceGainRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: 261.63, velocity: 0.8 })
    expect(triggerAttack).toHaveBeenCalledTimes(1)
    // Frequency in Hz passed as the first arg (quarter-tones come free).
    expect(triggerAttack.mock.calls[0][0]).toBeCloseTo(261.63, 2)
    // A per-voice gain ramp was driven toward the velocity.
    const lastGain = voiceGainRampTo.mock.calls.at(-1)?.[0]
    expect(lastGain).toBeGreaterThan(0)
  })

  it('round-robins voices across successive plucks', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (let i = 0; i < 5; i++) e.pluck({ freqHz: 200 + i, velocity: 0.5 })
    expect(triggerAttack).toHaveBeenCalledTimes(5) // 4-voice pool reused on the 5th
  })

  it('setReverbEnabled(false) forces wet → 0', () => {
    const { ToneMock, reverbWetRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setReverbWet(0.6)
    e.setReverbEnabled(false)
    expect(reverbWetRampTo.mock.calls.at(-1)?.[0]).toBe(0)
  })

  it('start() unlocks the audio context once', async () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    await e.start()
    expect(ToneMock.start).toHaveBeenCalledTimes(1)
    expect(e.isStarted).toBe(true)
  })
})
