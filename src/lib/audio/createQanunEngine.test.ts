import { describe, expect, it, vi } from 'vitest'
import { createQanunEngine, makeSoftClipCurve } from './createQanunEngine'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

// ─── mock factory ────────────────────────────────────────────────────────────

const makeMockTone = () => {
  const triggerAttack = vi.fn()           // PluckSynth triggerAttack
  const samplerTriggerAttack = vi.fn()    // Sampler triggerAttack (all instances)
  const samplerTriggerRelease = vi.fn()   // Sampler triggerRelease
  const samplerDispose = vi.fn()
  const samplerOnloads: Array<() => void> = []
  const voiceGainRampTo = vi.fn()
  const reverbWetRampTo = vi.fn()
  const loopStop = vi.fn()
  const loopDispose = vi.fn()
  const loopStart = vi.fn()
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
    // Tone.Sampler mock: captures the onload so tests can simulate the sampler
    // finishing its buffer load.
    Sampler: vi.fn().mockImplementation((opts: { onload?: () => void }) => {
      if (opts?.onload) samplerOnloads.push(opts.onload)
      return {
        triggerAttack: samplerTriggerAttack,
        triggerRelease: samplerTriggerRelease,
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
    // Tone.Clock mock: captures the callback so tests can inspect it. The
    // rashsh/trill loops run on a Clock (NOT the Transport) so their rate is
    // fixed Hz, independent of the metronome's Transport BPM.
    Clock: vi.fn().mockImplementation(() => ({
      start: loopStart,
      stop: loopStop,
      dispose: loopDispose
    }))
  }

  /** Simulate the sampler finishing its async buffer load. */
  const simulateSamplerLoaded = () => {
    samplerOnloads.forEach((fn) => fn())
  }

  return {
    ToneMock,
    triggerAttack,
    samplerTriggerAttack,
    samplerTriggerRelease,
    samplerDispose,
    simulateSamplerLoaded,
    voiceGainRampTo,
    reverbWetRampTo,
    loopStop,
    loopDispose,
    loopStart,
    chorusStart,
    chorusDispose,
    chorusWetValue,
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

// ─── soft-clip safety node (zero-attack anti-clipping final stage) ───────────

/** Extend the base mock with a Tone.WaveShaper so the soft-clip path is built. */
const makeToneWithWaveShaper = () => {
  const base = makeMockTone()
  const waveShaperConnect = vi.fn().mockReturnThis()
  const waveShaperToDestination = vi.fn().mockReturnThis()
  const waveShaperDispose = vi.fn()
  const waveShaperOutput = {}
  const waveShaperInstance = {
    oversample: 'none' as string,
    connect: waveShaperConnect,
    toDestination: waveShaperToDestination,
    output: waveShaperOutput,
    dispose: waveShaperDispose
  }
  const ToneMock = {
    ...base.ToneMock,
    WaveShaper: vi.fn().mockImplementation(() => waveShaperInstance)
  }
  return { ToneMock, base, waveShaperInstance, waveShaperToDestination, waveShaperDispose, waveShaperOutput }
}

describe('createQanunEngine — soft-clip safety node', () => {
  it('inserts a WaveShaper as the terminal node (limiter → softClip → destination)', () => {
    const { ToneMock, base, waveShaperToDestination } = makeToneWithWaveShaper()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.WaveShaper).toHaveBeenCalledTimes(1)
    // The soft-clip is the LAST node, so IT drives the destination — not the limiter.
    expect(waveShaperToDestination).toHaveBeenCalledTimes(1)
    expect(base.limiterToDestination).not.toHaveBeenCalled()
  })

  it('uses 4x oversampling for clean saturation', () => {
    const { ToneMock, waveShaperInstance } = makeToneWithWaveShaper()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(waveShaperInstance.oversample).toBe('4x')
  })

  it('getRecorderTap() taps the WaveShaper output (true final node) when present', () => {
    const { ToneMock, waveShaperOutput } = makeToneWithWaveShaper()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(e.getRecorderTap()).toBe(waveShaperOutput)
  })

  it('dispose() disposes the WaveShaper', () => {
    const { ToneMock, waveShaperDispose } = makeToneWithWaveShaper()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.dispose()
    expect(waveShaperDispose).toHaveBeenCalledTimes(1)
  })
})

describe('makeSoftClipCurve', () => {
  it('is transparent (identity) below the knee', () => {
    const curve = makeSoftClipCurve(2048)
    const idx = Math.round(((0.5 + 1) / 2) * (2048 - 1)) // input ≈ 0.5
    expect(curve[idx]).toBeCloseTo(0.5, 2)
  })

  it('bounds every sample strictly inside (-1, 1) — output can never clip', () => {
    const curve = makeSoftClipCurve(2048)
    for (const v of curve) {
      expect(v).toBeLessThan(1)
      expect(v).toBeGreaterThan(-1)
    }
    // Full-scale input is already saturated below 1 (but still up near the top).
    expect(curve[curve.length - 1]).toBeLessThan(1)
    expect(curve[curve.length - 1]).toBeGreaterThan(0.9)
  })

  it('is a monotonic non-decreasing transfer curve', () => {
    const curve = makeSoftClipCurve(512)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1])
    }
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

  // Anti-clipping: glide steps pass bloom:false so a fast drag fires 1 voice per
  // string instead of 3, keeping the master chain from being slammed.
  it('pluck({ bloom: false }) fires a single voice at the exact frequency', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: 440, velocity: 0.8, bloom: false })
    expect(triggerAttack).toHaveBeenCalledTimes(1)
    expect(triggerAttack.mock.calls[0][0] as number).toBeCloseTo(440, 5)
  })

  it('pluck() still blooms to 3 detuned voices by default', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: 440, velocity: 0.8 })
    expect(triggerAttack).toHaveBeenCalledTimes(3)
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
  it('holdStart() creates a Tone.Clock at the fixed rashsh rate (off the Transport)', () => {
    const { ToneMock, loopStart } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })

    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    // Clock constructor receives (callback, frequency in Hz).
    const [callback, frequency] = ToneMock.Clock.mock.calls[0]
    expect(typeof callback).toBe('function')
    // The rashsh rate is a fixed 9 Hz, independent of the Transport BPM.
    expect(frequency).toBe(9)

    expect(loopStart).toHaveBeenCalledTimes(1)
  })

  it('holdStart() immediately plucks the note (3 attacks on first call)', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    // Immediate pluck = 3 attacks.
    expect(triggerAttack).toHaveBeenCalledTimes(3)
  })

  it('holdStart({ immediate: false }) does NOT fire the initial 3-voice attack but still starts the loop', () => {
    const { ToneMock, triggerAttack, loopStart } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    // No initial attack.
    expect(triggerAttack).not.toHaveBeenCalled()
    // But the rashsh loop should still be created and started.
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    expect(loopStart).toHaveBeenCalledTimes(1)
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

  it('calling holdStart() twice reuses the single continuous loop (no restart)', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    e.holdStart({ freqHz: 330, velocity: 0.6 }) // updates the held note in place
    // One continuous loop — not torn down + rebuilt — so the phase stays stable.
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    expect(loopStop).not.toHaveBeenCalled()
    expect(loopDispose).not.toHaveBeenCalled()
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

// ─── holdAlternate (two-string alternating hold) ─────────────────────────────

describe('createQanunEngine — holdAlternate', () => {
  it('is exposed on the engine surface', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(typeof (e as unknown as Record<string, unknown>).holdAlternate).toBe('function')
  })

  it('creates a Tone.Clock at the single-trill rashsh pulse, no immediate attack', () => {
    const { ToneMock, loopStart, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    const [callback, frequency] = ToneMock.Clock.mock.calls[0]
    expect(typeof callback).toBe('function')
    // The alternation ticks at the SAME 9 Hz pulse as the single-string trill:
    // one pluck-weight note per tick, hi-lo-hi-lo, so each note is a distinct
    // event (like fast manual alternate plucking). At 2× (18 attacks/s) the
    // strikes land faster than the ~1.5 s ring decays on either string, and the
    // pair fuses into a continuous octave dyad — it reads as unison, not a trill.
    expect(frequency).toBe(9)
    expect(loopStart).toHaveBeenCalledTimes(1)
    // No initial pluck — the caller already plucked.
    expect(triggerAttack).not.toHaveBeenCalled()
  })

  it('alternates through freqs in order, starting with the first (higher) entry', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    // Drive the captured loop callback tick-by-tick.
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void

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

  it('blooms each trill tick to the triple-course cluster (like a pluck)', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    triggerAttack.mockClear()
    callback(0)
    // Each strike fires the full 3-voice triple-course bloom (a click/pluck does
    // the same) — that body + shimmer is what makes the trill read like fast
    // plucking instead of a thin, quiet seesaw. All three sit around the active
    // note (660), detuned by COURSE_CENTS, with one exactly on pitch.
    expect(triggerAttack).toHaveBeenCalledTimes(3)
    const freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.findIndex((f) => Math.abs(f - 660) < 0.01)).toBeGreaterThanOrEqual(0)
    expect(freqs.every((f) => Math.abs(f - 660) < 3)).toBe(true) // whole cluster hugs 660
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false) // the low string is silent this tick
  })

  it('1→2 swaps engines: the rashsh loop stops and the dedicated trill loop starts', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1) // single rashsh
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    // The rashsh loop is stopped; the trill engine gets its own loop.
    expect(loopStop).toHaveBeenCalledTimes(1)
    expect(loopDispose).toHaveBeenCalledTimes(1)
    expect(ToneMock.Clock).toHaveBeenCalledTimes(2)
    // Sliding while trilling retunes in place — no new loop, no restart.
    e.holdAlternate({ freqs: [660, 450], velocity: 0.7 })
    expect(ToneMock.Clock).toHaveBeenCalledTimes(2)
    expect(loopStop).toHaveBeenCalledTimes(1)
  })

  // The two-note trill must sound IDENTICAL regardless of when each finger landed:
  // it starts fresh and always LEADS with the higher note (freqs[0]), no matter
  // what internal phase the prior single-note loop had reached.
  it('the trill always leads with the higher note, regardless of prior single-note phase', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    // Hold the LOWER note alone; run its loop to an odd internal phase.
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const rashshCb = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    rashshCb(0)   // tick 0
    rashshCb(0.1) // tick 1
    rashshCb(0.2) // tick 2 → internal counter now odd
    // Add the HIGHER note → the dedicated trill loop starts fresh, leading high.
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const trillCb = ToneMock.Clock.mock.calls[1][0] as (t: number) => void
    triggerAttack.mockClear()
    trillCb(0.3) // first trill tick
    const freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)  // higher leads
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false) // not the lower
  })

  // Lifting one finger of a trill returns cleanly to the single-note tremolo.
  it('2→1 swaps back: the trill stops and a fresh single rashsh plays the survivor', () => {
    const { ToneMock, loopStop, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })         // trill loop (#1)
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false }) // one finger lifted
    expect(loopStop).toHaveBeenCalledTimes(1)                     // trill stopped
    expect(ToneMock.Clock).toHaveBeenCalledTimes(2)                // rashsh loop (#2)
    expect(ToneMock.Clock.mock.calls[1][1] as number).toBe(9)
    const cb = ToneMock.Clock.mock.calls[1][0] as (t: number) => void
    triggerAttack.mockClear()
    cb(0)
    expect(triggerAttack.mock.calls[0][0] as number).toBeCloseTo(440, 0)
  })

  // Phase resets only on a COUNT change (note added/removed), not when a held
  // note's pitch shifts — so a jittering held course can't restart the trill.
  it('does not reset the alternation phase when a held note shifts pitch (count unchanged)', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    callback(0) // tick 0 → 660 (internal counter → 1)
    // One held note jitters 440 → 450 (same count) — must NOT reset to tick 0.
    e.holdAlternate({ freqs: [660, 450], velocity: 0.7 })
    triggerAttack.mockClear()
    callback(0.05) // continues at tick 1 → the LOWER note (450), not a reset to 660
    const freqs = triggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 450) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(false)
  })

  // Independent strings: a strike sets only ITS OWN voice's level — the other
  // octave is never closed, so both rings overlap naturally until re-struck.
  it('never silences the other octave: strikes only set the struck voice level', () => {
    const { ToneMock, voiceGainRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    voiceGainRampTo.mockClear()
    callback(0); callback(0.1); callback(0.2) // hi, lo, hi
    // Three gate moves per tick (the triple-course bloom), always a strike level
    // (> 0), never a close (0) — the unstruck octave keeps ringing untouched.
    const levels = voiceGainRampTo.mock.calls.map((c) => c[0] as number)
    expect(levels).toHaveLength(9) // 3 ticks × 3-voice bloom
    expect(levels.every((l) => l > 0)).toBe(true)
  })

  it('releasing the trill lets the strings ring out (no gate slam on holdStop)', () => {
    const { ToneMock, voiceGainRampTo, loopStop } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    callback(0)
    voiceGainRampTo.mockClear()
    e.holdStop()
    expect(loopStop).toHaveBeenCalledTimes(1)           // the loop stops...
    expect(voiceGainRampTo).not.toHaveBeenCalled()      // ...but nothing is muted
  })

  // The trill must use the real SAMPLED qanun timbre once the sampler finishes
  // loading — the synth is only the brief loading fallback.
  it('strikes the sampled voice once the sampler loads', () => {
    const { ToneMock, samplerTriggerAttack, triggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    simulateSamplerLoaded()
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    triggerAttack.mockClear()
    callback(0)
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)  // sampled strike, bloomed
    expect(triggerAttack).not.toHaveBeenCalled()           // not the synth fallback
    const hiFreqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(hiFreqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
    // And it alternates on the sampled voice too.
    samplerTriggerAttack.mockClear()
    callback(0.1)
    const loFreqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(loFreqs.some((f) => Math.abs(f - 440) < 1)).toBe(true)
  })

  it('falls back to the synth while the sampler is still loading', () => {
    const { ToneMock, samplerTriggerAttack, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 }) // sampler NOT loaded yet
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    triggerAttack.mockClear()
    callback(0)
    expect(triggerAttack).toHaveBeenCalledTimes(3)         // synth fallback, bloomed
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  it('setSoundSource("synth") keeps the trill on the synth even with samples loaded', () => {
    const { ToneMock, samplerTriggerAttack, triggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    simulateSamplerLoaded()
    e.setSoundSource('synth')
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    triggerAttack.mockClear()
    callback(0)
    expect(triggerAttack).toHaveBeenCalledTimes(3)
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  it('single-note hold never gates to silence between strikes (it rings/shimmers)', () => {
    const { ToneMock, voiceGainRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    voiceGainRampTo.mockClear()
    callback(0); callback(0.1); callback(0.2) // same pitch repeated
    // Pool voices only ramp UP to strike level; nothing is ever gated to 0.
    expect(voiceGainRampTo.mock.calls.length).toBeGreaterThan(0)
    expect(voiceGainRampTo.mock.calls.every((c) => (c[0] as number) > 0)).toBe(true)
  })

  it('filters out non-finite freqs (the loop only plays valid notes)', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock, 16))
    e.holdAlternate({ freqs: [NaN, 440], velocity: 0.7 }) // NaN filtered → only 440 held
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    triggerAttack.mockClear()
    expect(() => callback(0)).not.toThrow()
    // Every tick plays the one valid note (single-voice rashsh = 1 attack).
    expect(triggerAttack).toHaveBeenCalledTimes(1)
  })

  it('empty freqs is a no-op (no loop created)', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdAlternate({ freqs: [], velocity: 0.7 })
    expect(ToneMock.Clock).not.toHaveBeenCalled()
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
