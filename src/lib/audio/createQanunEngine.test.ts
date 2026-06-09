import { describe, expect, it, vi } from 'vitest'
import { createQanunEngine } from './createQanunEngine'

// ─── mock factory ────────────────────────────────────────────────────────────

const makeMockTone = () => {
  const triggerAttack = vi.fn()
  const voiceGainRampTo = vi.fn()
  const reverbWetRampTo = vi.fn()
  const loopStop = vi.fn()
  const loopDispose = vi.fn()
  const loopStart = vi.fn()
  const transportStart = vi.fn()

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
    })),
    // Tone.Loop mock: captures the callback so tests can inspect it.
    Loop: vi.fn().mockImplementation(() => ({
      start: loopStart,
      stop: loopStop,
      dispose: loopDispose
    })),
    Transport: { start: transportStart }
  }

  return {
    ToneMock,
    triggerAttack,
    voiceGainRampTo,
    reverbWetRampTo,
    loopStop,
    loopDispose,
    loopStart,
    transportStart
  }
}

/**
 * Helper: create engine with a small polyphony for tests.
 * polyphony=4 → pool = 4 × 3 = 12 raw voices.
 */
const ENGINE_ARGS = (ToneMock: unknown, polyphony = 4) => ({
  Tone: ToneMock as unknown as typeof import('tone'),
  polyphony
})

// ─── surface / backwards-compat tests ────────────────────────────────────────

describe('createQanunEngine — surface', () => {
  it('exposes the documented surface including holdStart/holdStop', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (const fn of [
      'start', 'dispose', 'pluck',
      'holdStart', 'holdStop',
      'setReverbEnabled', 'setReverbWet', 'setReverbSize', 'getSampleRate'
    ]) {
      expect(typeof (e as unknown as Record<string, unknown>)[fn]).toBe('function')
    }
    expect(e.isStarted).toBe(false)
  })

  it('start() unlocks the audio context once, even when called twice', async () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    await e.start()
    await e.start() // idempotent — guarded by `started`
    expect(ToneMock.start).toHaveBeenCalledTimes(1)
    expect(e.isStarted).toBe(true)
  })

  it('getSampleRate delegates to Tone.getContext()', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(e.getSampleRate()).toBe(48000)
  })
})

// ─── voice pool ───────────────────────────────────────────────────────────────

describe('createQanunEngine — voice pool', () => {
  it('builds a pool of polyphony × 3 PluckSynth voices', () => {
    const { ToneMock } = makeMockTone()
    // polyphony=4 → 12 voices in pool
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.PluckSynth).toHaveBeenCalledTimes(4 * 3)
  })

  it('PluckSynth is constructed with high resonance for long ring', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    const opts = ToneMock.PluckSynth.mock.calls[0][0] as Record<string, unknown>
    // resonance ≥ 0.95 → ring time ~1.5–2 s at 440 Hz
    expect(opts.resonance).toBeGreaterThanOrEqual(0.95)
    // dampening < 4000 Hz → slightly warmer than the v1 bright 4000 Hz
    expect(opts.dampening).toBeLessThanOrEqual(4000)
  })
})

// ─── triple-course pluck (v2 core feature) ────────────────────────────────────

describe('createQanunEngine — triple-course pluck', () => {
  it('one pluck() triggers exactly 3 voice attacks at 3 detuned frequencies', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: 440, velocity: 0.8 })

    expect(triggerAttack).toHaveBeenCalledTimes(3)

    const freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    // One should equal exactly 440 (0 cents offset).
    const zeroIdx = freqs.findIndex((f) => Math.abs(f - 440) < 0.01)
    expect(zeroIdx).toBeGreaterThanOrEqual(0)
    // One should be slightly below 440 (−4 cents ≈ 440 * 2^(−4/1200)).
    const loFreq = 440 * Math.pow(2, -4 / 1200)
    const loIdx = freqs.findIndex((f) => Math.abs(f - loFreq) < 0.01)
    expect(loIdx).toBeGreaterThanOrEqual(0)
    // One should be slightly above 440 (+4 cents ≈ 440 * 2^(4/1200)).
    const hiFreq = 440 * Math.pow(2, 4 / 1200)
    const hiIdx = freqs.findIndex((f) => Math.abs(f - hiFreq) < 0.01)
    expect(hiIdx).toBeGreaterThanOrEqual(0)
    // All three indices must be distinct.
    expect(new Set([zeroIdx, loIdx, hiIdx]).size).toBe(3)
  })

  it('gain ramp fires 3 times (once per detuned voice)', () => {
    const { ToneMock, voiceGainRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: 261.63, velocity: 0.5 })
    expect(voiceGainRampTo).toHaveBeenCalledTimes(3)
    voiceGainRampTo.mock.calls.forEach(([gain]) => {
      expect(gain).toBeGreaterThan(0)
    })
  })

  it('ignores invalid frequencies', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: -1, velocity: 0.5 })
    e.pluck({ freqHz: 0, velocity: 0.5 })
    e.pluck({ freqHz: NaN, velocity: 0.5 })
    expect(triggerAttack).not.toHaveBeenCalled()
  })
})

// ─── round-robin distribution (v2: each pluck uses 3 consecutive voices) ─────

describe('createQanunEngine — round-robin', () => {
  it('successive plucks distribute across voices (no single voice gets every attack)', () => {
    const base = makeMockTone()
    const perVoiceAttacks: Array<ReturnType<typeof vi.fn>> = []
    const ToneMock = {
      ...base.ToneMock,
      PluckSynth: vi.fn().mockImplementation(() => {
        const ta = vi.fn()
        perVoiceAttacks.push(ta)
        return { triggerAttack: ta, connect: vi.fn().mockReturnThis(), dispose: vi.fn() }
      })
    }
    // polyphony=4 → 12 voices; 3 plucks will use voices 0–8 (no overlap).
    const e = createQanunEngine({ Tone: ToneMock as unknown as typeof import('tone'), polyphony: 4 })
    e.pluck({ freqHz: 220, velocity: 0.5 })
    e.pluck({ freqHz: 330, velocity: 0.5 })
    e.pluck({ freqHz: 440, velocity: 0.5 })

    // Total attacks: 3 plucks × 3 voices = 9
    const total = perVoiceAttacks.reduce((sum, s) => sum + s.mock.calls.length, 0)
    expect(total).toBe(9)

    // At least 9 distinct voice slots should have been used (no voice used
    // more than once, since we have 12 voices for 3 plucks).
    const used = perVoiceAttacks.filter((s) => s.mock.calls.length > 0).length
    expect(used).toBe(9)
  })

  it('wraps back to earlier voices after the pool is exhausted', () => {
    const base = makeMockTone()
    const perVoiceAttacks: Array<ReturnType<typeof vi.fn>> = []
    const ToneMock = {
      ...base.ToneMock,
      PluckSynth: vi.fn().mockImplementation(() => {
        const ta = vi.fn()
        perVoiceAttacks.push(ta)
        return { triggerAttack: ta, connect: vi.fn().mockReturnThis(), dispose: vi.fn() }
      })
    }
    // polyphony=1 → pool=3 voices. Each pluck needs 3 → 2nd pluck reuses all.
    const e = createQanunEngine({ Tone: ToneMock as unknown as typeof import('tone'), polyphony: 1 })
    e.pluck({ freqHz: 220, velocity: 0.5 }) // voices 0,1,2
    e.pluck({ freqHz: 440, velocity: 0.5 }) // wraps back to 0,1,2
    // Each of the 3 voices should have been attacked twice.
    perVoiceAttacks.forEach((s) => {
      expect(s).toHaveBeenCalledTimes(2)
    })
  })
})

// ─── reverb defaults (v2: enabled by default) ────────────────────────────────

describe('createQanunEngine — reverb', () => {
  it('reverb is enabled with wet > 0 on construction (body resonance default)', () => {
    const { ToneMock } = makeMockTone()
    // Capture the wet passed to Reverb constructor.
    let constructedWet = 0
    const ToneMockWithCapture = {
      ...ToneMock,
      Reverb: vi.fn().mockImplementation((opts: Record<string, number>) => {
        constructedWet = opts.wet
        return {
          wet: { value: opts.wet, rampTo: vi.fn() },
          decay: 0, preDelay: 0,
          connect: vi.fn().mockReturnThis(),
          dispose: vi.fn()
        }
      })
    }
    createQanunEngine(ENGINE_ARGS(ToneMockWithCapture))
    expect(constructedWet).toBeGreaterThan(0)
  })

  it('setReverbEnabled(false) forces wet → 0', () => {
    const { ToneMock, reverbWetRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setReverbWet(0.6)
    e.setReverbEnabled(false)
    expect(reverbWetRampTo.mock.calls.at(-1)?.[0]).toBe(0)
  })

  it('setReverbEnabled(true) restores the stored wet level', () => {
    const { ToneMock, reverbWetRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setReverbWet(0.6)
    e.setReverbEnabled(false)
    e.setReverbEnabled(true)
    expect(reverbWetRampTo.mock.calls.at(-1)?.[0]).toBeCloseTo(0.6, 6)
  })
})

// ─── rashsh hold (v2 new feature) ────────────────────────────────────────────

describe('createQanunEngine — rashsh hold', () => {
  it('holdStart() creates a Tone.Loop and starts Tone.Transport', () => {
    const { ToneMock, loopStart, transportStart } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })

    expect(ToneMock.Loop).toHaveBeenCalledTimes(1)
    // Loop constructor receives (callback, interval).
    const [callback, interval] = ToneMock.Loop.mock.calls[0]
    expect(typeof callback).toBe('function')
    // Interval should be close to 1/7 s (rashsh ~7 Hz).
    expect(interval).toBeCloseTo(1 / 7, 3)

    expect(loopStart).toHaveBeenCalledWith(0)
    expect(transportStart).toHaveBeenCalledTimes(1)
  })

  it('holdStart() immediately plucks the note (3 attacks on first call)', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    // Immediate pluck = 3 attacks.
    expect(triggerAttack).toHaveBeenCalledTimes(3)
  })

  it('holdStop() stops and disposes the active loop', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    e.holdStop()
    expect(loopStop).toHaveBeenCalledTimes(1)
    expect(loopDispose).toHaveBeenCalledTimes(1)
  })

  it('holdStop() is a no-op when no loop is active', () => {
    const { ToneMock, loopStop } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(() => e.holdStop()).not.toThrow()
    expect(loopStop).not.toHaveBeenCalled()
  })

  it('calling holdStart() twice cancels the first loop before creating the second', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    e.holdStart({ freqHz: 330, velocity: 0.6 }) // should cancel previous
    // First loop disposed before second was created.
    expect(loopStop).toHaveBeenCalledTimes(1)
    expect(loopDispose).toHaveBeenCalledTimes(1)
    // Two Loop instances created.
    expect(ToneMock.Loop).toHaveBeenCalledTimes(2)
  })

  it('dispose() stops an active hold loop', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    e.dispose()
    expect(loopStop).toHaveBeenCalledTimes(1)
    expect(loopDispose).toHaveBeenCalledTimes(1)
  })
})
