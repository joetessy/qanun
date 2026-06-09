import { describe, expect, it, vi } from 'vitest'
import { createQanunEngine } from './createQanunEngine'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

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
  // Tone.Limiter mock: brick-wall on the master chain (sumBus → limiter →
  // destination). connect/toDestination/dispose, plus an `output` node so
  // getRecorderTap() can tap it.
  const limiterConnect = vi.fn().mockReturnThis()
  const limiterToDestination = vi.fn().mockReturnThis()
  const limiterDispose = vi.fn()
  const limiterOutput = {}
  // Tone.Vibrato mock: a settable depth.value + frequency.value, plus
  // connect/dispose. The node lives in the output chain (sources → Vibrato →
  // reverb), bending the pitch of everything that flows through it.
  const vibratoConnect = vi.fn()
  const vibratoDispose = vi.fn()
  // Capture the live Vibrato object so tests can assert on depth/frequency.value.
  const vibratoState = { depth: { value: 0 }, frequency: { value: 0 } }

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
    // Tone.Limiter mock: brick-wall master limiter (sumBus → limiter → dest).
    Limiter: vi.fn().mockImplementation((threshold: number) => ({
      threshold: { value: threshold },
      connect: limiterConnect,
      toDestination: limiterToDestination,
      output: limiterOutput,
      dispose: limiterDispose
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
    // Tone.Vibrato mock: depth/frequency proxy to vibratoState so tests can read
    // what setVibrato() wrote.
    Vibrato: vi.fn().mockImplementation((opts: { frequency?: number; depth?: number; maxDelay?: number }) => {
      vibratoState.depth.value = opts?.depth ?? 0
      vibratoState.frequency.value = opts?.frequency ?? 0
      return {
        depth: vibratoState.depth,
        frequency: vibratoState.frequency,
        connect: vibratoConnect,
        dispose: vibratoDispose
      }
    }),
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
    chorusWetValue,
    vibratoConnect,
    vibratoDispose,
    vibratoState,
    limiterConnect,
    limiterToDestination,
    limiterDispose,
    limiterOutput
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
      'holdStart', 'holdAlternate', 'holdStop',
      'trill',
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

// ─── master chain / brick-wall limiter (anti-clipping) ───────────────────────

describe('createQanunEngine — master limiter', () => {
  it('runs sumBus at 0.8 for headroom (not unity 1.0)', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    // The Gain constructed with the largest value is the master sumBus; voice
    // gains are all created at 0. sumBus must now be 0.8, not 1.0.
    const gainArgs = ToneMock.Gain.mock.calls.map((c) => c[0] as number)
    expect(gainArgs).toContain(0.8)
    expect(gainArgs).not.toContain(1)
  })

  it('constructs a Tone.Limiter at -1 dBFS and wires sumBus → limiter → destination', () => {
    const { ToneMock, limiterToDestination } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.Limiter).toHaveBeenCalledTimes(1)
    expect(ToneMock.Limiter.mock.calls[0][0]).toBe(-1)
    // The limiter is the terminal node: it drives the destination (sumBus
    // connects INTO it via sumBus.connect(limiter), so the limiter itself only
    // needs toDestination()). sumBus must NOT call toDestination in this path.
    expect(limiterToDestination).toHaveBeenCalledTimes(1)
  })

  it('getRecorderTap() taps the limiter output (final audible node) when present', () => {
    const { ToneMock, limiterOutput } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    // Recording must match what's heard → the post-limiter node.
    expect(e.getRecorderTap()).toBe(limiterOutput)
  })

  it('dispose() disposes the limiter', () => {
    const { ToneMock, limiterDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.dispose()
    expect(limiterDispose).toHaveBeenCalledTimes(1)
  })

  it('falls back to sumBus.toDestination() and taps sumBus when Tone has no Limiter', () => {
    const base = makeMockTone()
    // A mock lacking Tone.Limiter: the guard must keep the engine working —
    // sumBus drives the destination directly and the recorder taps sumBus.
    const toneNoLimiter = { ...base.ToneMock, Limiter: undefined }
    const e = createQanunEngine({
      Tone: toneNoLimiter as unknown as typeof import('tone'),
      polyphony: 4
    })
    expect(() => e.dispose()).not.toThrow()
    // getRecorderTap() returns the sumBus output (an object) without throwing.
    const e2 = createQanunEngine({
      Tone: { ...base.ToneMock, Limiter: undefined } as unknown as typeof import('tone'),
      polyphony: 4
    })
    expect(e2.getRecorderTap()).toBeDefined()
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
    // Interval should be close to 1/10 s (rashsh ~10 Hz).
    expect(interval).toBeCloseTo(1 / 10, 3)

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

  it('holdStart({ immediate: false }) does NOT fire the initial 3-voice attack but still starts the loop', () => {
    const { ToneMock, triggerAttack, loopStart, transportStart } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    // No initial attack.
    expect(triggerAttack).not.toHaveBeenCalled()
    // But the rashsh loop should still be created and started.
    expect(ToneMock.Loop).toHaveBeenCalledTimes(1)
    expect(loopStart).toHaveBeenCalledWith(0)
    expect(transportStart).toHaveBeenCalledTimes(1)
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

  it('setVibrato clamps cents to [0, MAX] and is callable before any hold', () => {
    const { ToneMock, vibratoState } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(typeof (e as unknown as Record<string, unknown>).setVibrato).toBe('function')
    // Out-of-range cents (high/low) and an optional rate are all tolerated.
    expect(() => e.setVibrato({ cents: 999 })).not.toThrow()
    // 999 clamps to MAX_VIBRATO_CENTS (45) → full depth 0.22 (gentle factor).
    expect(vibratoState.depth.value).toBeCloseTo(0.22, 6)
    expect(() => e.setVibrato({ cents: -5, rateHz: 6 })).not.toThrow()
    // Negative cents clamps to 0 → depth 0; rateHz drives the Vibrato frequency.
    expect(vibratoState.depth.value).toBe(0)
    expect(vibratoState.frequency.value).toBe(6)
  })
})

// ─── vibrato (Tone.Vibrato effect node in the output chain) ──────────────────

describe('createQanunEngine — vibrato', () => {
  it('creates a Tone.Vibrato node at engine setup and wires it into the chain', () => {
    const { ToneMock, vibratoConnect } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.Vibrato).toHaveBeenCalledTimes(1)
    // The node routes onward to reverb (vibrato → reverb).
    expect(vibratoConnect).toHaveBeenCalledTimes(1)
  })

  it('constructs Vibrato with depth 0 (inaudible until setVibrato opens it)', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    const opts = ToneMock.Vibrato.mock.calls[0][0] as { depth?: number; frequency?: number }
    expect(opts.depth).toBe(0)
    expect(opts.frequency).toBeGreaterThan(0)
  })

  it('setVibrato({ cents }) maps cents → normal-range depth (gentle 0.22 factor)', () => {
    const { ToneMock, vibratoState } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    // 22.5 of 45 cents → half-scale → depth (22.5/45)*0.22 = 0.11.
    e.setVibrato({ cents: 22.5 })
    expect(vibratoState.depth.value).toBeCloseTo(0.11, 6)
  })

  it('setVibrato({ cents: 0 }) collapses depth to 0 (no audible vibrato)', () => {
    const { ToneMock, vibratoState } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setVibrato({ cents: 50, rateHz: 6 })
    e.setVibrato({ cents: 0 })
    expect(vibratoState.depth.value).toBe(0)
  })

  it('setVibrato({ rateHz }) drives the Vibrato frequency', () => {
    const { ToneMock, vibratoState } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setVibrato({ cents: 40, rateHz: 7 })
    expect(vibratoState.frequency.value).toBe(7)
  })

  it('dispose() disposes the Vibrato node', () => {
    const { ToneMock, vibratoDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.dispose()
    expect(vibratoDispose).toHaveBeenCalledTimes(1)
  })

  it('setVibrato is a safe no-op when Tone has no Vibrato (mock without Vibrato)', () => {
    const base = makeMockTone()
    // Simulate a mock that lacks Vibrato: setVibrato must no-op rather than crash.
    const toneNoVibrato = { ...base.ToneMock, Vibrato: undefined }
    const e = createQanunEngine({
      Tone: toneNoVibrato as unknown as typeof import('tone'),
      polyphony: 4
    })
    expect(() => e.setVibrato({ cents: 30, rateHz: 6 })).not.toThrow()
  })
})

// ─── holdAlternate (two-string alternating hold) ─────────────────────────────

describe('createQanunEngine — holdAlternate', () => {
  it('is exposed on the engine surface', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(typeof (e as unknown as Record<string, unknown>).holdAlternate).toBe('function')
  })

  it('creates a Tone.Loop and starts Tone.Transport, no immediate attack', () => {
    const { ToneMock, loopStart, transportStart, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    expect(ToneMock.Loop).toHaveBeenCalledTimes(1)
    const [callback, interval] = ToneMock.Loop.mock.calls[0]
    expect(typeof callback).toBe('function')
    // Alternation ticks at ALTERNATE_HZ (5.5) — slower than the single-note
    // rashsh (10 Hz) so the two pitches are individually audible.
    expect(interval).toBeCloseTo(1 / 5.5, 3)
    expect(loopStart).toHaveBeenCalledWith(0)
    expect(transportStart).toHaveBeenCalledTimes(1)
    // No initial pluck — the caller already plucked.
    expect(triggerAttack).not.toHaveBeenCalled()
  })

  it('alternates through freqs in order, starting with the first (higher) entry', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    // Drive the captured loop callback tick-by-tick.
    const callback = ToneMock.Loop.mock.calls[0][0] as (t: number) => void

    // Tick 0 → freqs[0] = 660 (the higher note sounds first).
    triggerAttack.mockClear()
    callback(0)
    let freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false)

    // Tick 1 → freqs[1] = 440.
    triggerAttack.mockClear()
    callback(0.1)
    freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(false)

    // Tick 2 → wraps back to freqs[0] = 660.
    triggerAttack.mockClear()
    callback(0.2)
    freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
  })

  it('fires 3 detuned voices per tick (triple-course)', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Loop.mock.calls[0][0] as (t: number) => void
    triggerAttack.mockClear()
    callback(0)
    expect(triggerAttack).toHaveBeenCalledTimes(3)
  })

  it('cancels a previous hold before starting (single active loop)', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    expect(loopStop).toHaveBeenCalledTimes(1)
    expect(loopDispose).toHaveBeenCalledTimes(1)
    expect(ToneMock.Loop).toHaveBeenCalledTimes(2)
  })

  it('skips non-finite freqs per tick without throwing', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [NaN, 440], velocity: 0.7 })
    const callback = ToneMock.Loop.mock.calls[0][0] as (t: number) => void
    // Tick 0 → NaN → no attack.
    triggerAttack.mockClear()
    expect(() => callback(0)).not.toThrow()
    expect(triggerAttack).not.toHaveBeenCalled()
    // Tick 1 → 440 → 3 attacks.
    triggerAttack.mockClear()
    callback(0.1)
    expect(triggerAttack).toHaveBeenCalledTimes(3)
  })

  it('empty freqs is a no-op (no loop created)', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdAlternate({ freqs: [], velocity: 0.7 })
    expect(ToneMock.Loop).not.toHaveBeenCalled()
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
    expect(opts.baseUrl).toBe(QANUN_SAMPLE_BASE_URL)
    expect(Object.keys(opts.urls)).toHaveLength(18)
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
