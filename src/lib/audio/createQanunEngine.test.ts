import { describe, expect, it, vi } from 'vitest'
import { createQanunEngine } from './createQanunEngine'
import { QANUN_SAMPLE_URLS } from './qanunSamples'

// ─── mock factory ────────────────────────────────────────────────────────────

const makeMockTone = () => {
  const triggerAttack = vi.fn()           // PluckSynth triggerAttack
  const samplerTriggerAttack = vi.fn()    // Sampler triggerAttack
  const samplerDispose = vi.fn()
  let samplerOnload: (() => void) | undefined
  const voiceGainRampTo = vi.fn()
  const reverbWetRampTo = vi.fn()
  const loopStop = vi.fn()
  const loopDispose = vi.fn()
  const loopStart = vi.fn()
  const transportStart = vi.fn()
  const chorusStart = vi.fn()
  const chorusDispose = vi.fn()
  const chorusWetValue = { value: 0 }

  const ToneMock = {
    start: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => 0.0),
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
      output: {},
      dispose: vi.fn()
    })),
    Reverb: vi.fn().mockImplementation(() => ({
      wet: { value: 0, rampTo: reverbWetRampTo },
      decay: 0,
      preDelay: 0,
      connect: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    })),
    // Tone.Sampler mock: captures onload so tests can simulate loading.
    Sampler: vi.fn().mockImplementation((opts: { onload?: () => void }) => {
      samplerOnload = opts?.onload
      return {
        triggerAttack: samplerTriggerAttack,
        connect: vi.fn().mockReturnThis(),
        dispose: samplerDispose
      }
    }),
    // Tone.Chorus mock: subtle shimmer on sampler path.
    Chorus: vi.fn().mockImplementation(() => ({
      wet: chorusWetValue,
      connect: vi.fn().mockReturnThis(),
      start: chorusStart,
      stop: vi.fn(),
      dispose: chorusDispose
    })),
    // Tone.Loop mock: captures the callback so tests can inspect it.
    Loop: vi.fn().mockImplementation(() => ({
      start: loopStart,
      stop: loopStop,
      dispose: loopDispose
    })),
    Transport: { start: transportStart }
  }

  /** Simulate the sampler finishing its async buffer load. */
  const simulateSamplerLoaded = () => {
    samplerOnload?.()
  }

  return {
    ToneMock,
    triggerAttack,
    samplerTriggerAttack,
    samplerDispose,
    simulateSamplerLoaded,
    voiceGainRampTo,
    reverbWetRampTo,
    loopStop,
    loopDispose,
    loopStart,
    transportStart,
    chorusStart,
    chorusDispose,
    chorusWetValue
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
  it('exposes the documented surface including holdStart/holdStop and P2 sampler methods', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (const fn of [
      'start', 'dispose', 'pluck',
      'holdStart', 'holdStop',
      'setReverbEnabled', 'setReverbWet', 'setReverbSize', 'getSampleRate',
      'getRecorderTap',
      'setSoundSource'
    ]) {
      expect(typeof (e as unknown as Record<string, unknown>)[fn]).toBe('function')
    }
    expect(e.isStarted).toBe(false)
    expect(e.soundSource).toBe('sample')
    expect(e.isSampleLoaded).toBe(false)
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

// ─── trill (finite upper-neighbor burst) ─────────────────────────────────────

describe('createQanunEngine — trill', () => {
  it('trill is exposed on the engine surface', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(typeof (e as unknown as Record<string, unknown>).trill).toBe('function')
  })

  it('schedules alternating principal/neighbor freqs at strictly increasing times', () => {
    const capturedCalls: Array<{ freq: number; time: number }> = []
    const base = makeMockTone()
    const ToneMockWithNow = {
      ...base.ToneMock,
      // Tone.now() returns 1.0 so we can assert on offsets
      now: vi.fn(() => 1.0),
      PluckSynth: vi.fn().mockImplementation(() => ({
        triggerAttack: vi.fn().mockImplementation((freq: number, time?: number) => {
          capturedCalls.push({ freq, time: time ?? 0 })
        }),
        connect: vi.fn().mockReturnThis(),
        dispose: vi.fn()
      }))
    }
    const e = createQanunEngine({
      Tone: ToneMockWithNow as unknown as typeof import('tone'),
      polyphony: 16
    })
    const principalHz = 440
    const neighborHz = 495  // arbitrary neighbor
    e.trill({ freqHz: principalHz, neighborHz, velocity: 0.7 })

    // cycles=4 → 9 attacks; each attack = 3 voices → 27 triggerAttack calls
    expect(capturedCalls).toHaveLength(4 * 2 * 3 + 3) // (4 pairs + 1 final principal) × 3 voices = 27

    // Extract one representative call per scheduled step (every 3rd, one per voice cluster).
    // Times should be strictly increasing.
    const times = capturedCalls.map(c => c.time)
    const uniqueTimes = [...new Set(times)].sort((a, b) => a - b)
    expect(uniqueTimes.length).toBe(9) // 9 distinct time offsets
    for (let i = 1; i < uniqueTimes.length; i++) {
      expect(uniqueTimes[i]).toBeGreaterThan(uniqueTimes[i - 1])
    }

    // Times start at Tone.now() (1.0) and step by ~1/7 s
    expect(uniqueTimes[0]).toBeCloseTo(1.0, 5)
    expect(uniqueTimes[1]).toBeCloseTo(1.0 + 1 / 7, 3)

    // The first and last scheduled freqs (ignoring detuning) should be principal
    const firstClusterFreqs = capturedCalls.filter(c => Math.abs(c.time - uniqueTimes[0]) < 0.001).map(c => c.freq)
    const lastClusterFreqs  = capturedCalls.filter(c => Math.abs(c.time - uniqueTimes[8]) < 0.001).map(c => c.freq)
    // At least one of the 3 detuned voices should be within 5 Hz of the principal.
    expect(firstClusterFreqs.some(f => Math.abs(f - principalHz) < 5)).toBe(true)
    expect(lastClusterFreqs.some(f => Math.abs(f - principalHz) < 5)).toBe(true)

    // Intermediate step (index 1) should be near neighborHz
    const secondClusterFreqs = capturedCalls.filter(c => Math.abs(c.time - uniqueTimes[1]) < 0.001).map(c => c.freq)
    expect(secondClusterFreqs.some(f => Math.abs(f - neighborHz) < 5)).toBe(true)
  })

  it('resolves on the principal (last attack cluster is the principal)', () => {
    const capturedCalls: Array<{ freq: number; time: number }> = []
    const base = makeMockTone()
    const ToneMockWithNow = {
      ...base.ToneMock,
      now: vi.fn(() => 0.0),
      PluckSynth: vi.fn().mockImplementation(() => ({
        triggerAttack: vi.fn().mockImplementation((freq: number, time?: number) => {
          capturedCalls.push({ freq, time: time ?? 0 })
        }),
        connect: vi.fn().mockReturnThis(),
        dispose: vi.fn()
      }))
    }
    const e = createQanunEngine({
      Tone: ToneMockWithNow as unknown as typeof import('tone'),
      polyphony: 16
    })
    e.trill({ freqHz: 261.63, neighborHz: 293.66, velocity: 0.7 })

    const times = [...new Set(capturedCalls.map(c => c.time))].sort((a, b) => a - b)
    const lastTime = times[times.length - 1]
    const lastCluster = capturedCalls.filter(c => Math.abs(c.time - lastTime) < 0.001)
    // Last cluster should be near 261.63 (principal), not 293.66 (neighbor)
    expect(lastCluster.some(f => Math.abs(f.freq - 261.63) < 5)).toBe(true)
    expect(lastCluster.every(f => Math.abs(f.freq - 293.66) >= 5)).toBe(true)
  })

  it('respects custom cycles count', () => {
    const capturedCalls: Array<{ freq: number; time: number }> = []
    const base = makeMockTone()
    const ToneMockWithNow = {
      ...base.ToneMock,
      now: vi.fn(() => 0.0),
      PluckSynth: vi.fn().mockImplementation(() => ({
        triggerAttack: vi.fn().mockImplementation((freq: number, time?: number) => {
          capturedCalls.push({ freq, time: time ?? 0 })
        }),
        connect: vi.fn().mockReturnThis(),
        dispose: vi.fn()
      }))
    }
    const e = createQanunEngine({
      Tone: ToneMockWithNow as unknown as typeof import('tone'),
      polyphony: 16
    })
    // cycles=2 → p n p n p = 5 attacks × 3 voices = 15
    e.trill({ freqHz: 440, neighborHz: 495, velocity: 0.7, cycles: 2 })
    expect(capturedCalls).toHaveLength(5 * 3)
    const uniqueTimes = [...new Set(capturedCalls.map(c => c.time))].sort((a, b) => a - b)
    expect(uniqueTimes.length).toBe(5)
  })
})

// ─── P2: Tone.Sampler construction ───────────────────────────────────────────

describe('createQanunEngine — sampler construction', () => {
  it('builds a Tone.Sampler with the QANUN_SAMPLE_URLS map', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.Sampler).toHaveBeenCalledTimes(1)
    const opts = ToneMock.Sampler.mock.calls[0][0] as { urls: Record<string, string>; baseUrl: string }
    // The urls object should match the exported sample map exactly.
    expect(opts.urls).toEqual(QANUN_SAMPLE_URLS)
    expect(Object.keys(opts.urls)).toHaveLength(17)
  })

  it('builds a Tone.Chorus for the sampler shimmer path', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.Chorus).toHaveBeenCalledTimes(1)
  })

  it('starts the Chorus LFO on construction', () => {
    const { ToneMock, chorusStart } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(chorusStart).toHaveBeenCalledTimes(1)
  })

  it('defaults to soundSource=sample and isSampleLoaded=false before onload fires', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(e.soundSource).toBe('sample')
    expect(e.isSampleLoaded).toBe(false)
  })

  it('isSampleLoaded becomes true after the Sampler onload callback fires', () => {
    const { ToneMock, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(e.isSampleLoaded).toBe(false)
    simulateSamplerLoaded()
    expect(e.isSampleLoaded).toBe(true)
  })
})

// ─── P2: sound-source routing ─────────────────────────────────────────────────

describe('createQanunEngine — sound-source routing', () => {
  it('pluck() falls back to synth when source=sample but sampler not yet loaded', () => {
    const { ToneMock, triggerAttack, samplerTriggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    // Default: source=sample, loaded=false → synth fallback
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(triggerAttack).toHaveBeenCalled()        // synth fired
    expect(samplerTriggerAttack).not.toHaveBeenCalled() // sampler NOT fired
  })

  it('pluck() uses sampler when source=sample AND sampler is loaded', () => {
    const { ToneMock, triggerAttack, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(samplerTriggerAttack).toHaveBeenCalled()  // sampler fired
    expect(triggerAttack).not.toHaveBeenCalled()     // synth NOT fired
  })

  it('pluck() fires sampler 3× (triple-course) when loaded', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.8 })
    // 3 detuned attacks on the sampler
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
  })

  it('setSoundSource("synth") routes pluck to synth even when sampler is loaded', () => {
    const { ToneMock, triggerAttack, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.setSoundSource('synth')
    expect(e.soundSource).toBe('synth')
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(triggerAttack).toHaveBeenCalled()         // synth fired
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  it('setSoundSource("sample") switches back to sampler after synth mode', () => {
    const { ToneMock, triggerAttack, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.setSoundSource('synth')
    e.setSoundSource('sample')
    expect(e.soundSource).toBe('sample')
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(samplerTriggerAttack).toHaveBeenCalled()
    expect(triggerAttack).not.toHaveBeenCalled()
  })

  it('dispose() disposes the sampler and chorus', () => {
    const { ToneMock, samplerDispose, chorusDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.dispose()
    expect(samplerDispose).toHaveBeenCalledTimes(1)
    expect(chorusDispose).toHaveBeenCalledTimes(1)
  })
})
