import { describe, expect, it, vi } from 'vitest'
import {
  createQanunEngine,
  makeSoftClipCurve,
  DEFAULT_TREMOLO_HZ,
  TREMOLO_HZ_MIN,
  TREMOLO_HZ_MAX
} from './createQanunEngine'
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
    immediate: vi.fn(() => 0.0),
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
    // single shared hold loop (rashsh + trill) runs on a Clock (NOT the
    // Transport) so its rate is fixed Hz, independent of the metronome's
    // Transport BPM. `frequency.value` mirrors Tone's retunable TickSignal —
    // the engine retunes the RUNNING clock instead of restarting it.
    Clock: vi.fn().mockImplementation((_cb: (t: number) => void, frequency: number) => ({
      start: loopStart,
      stop: loopStop,
      dispose: loopDispose,
      frequency: { value: frequency }
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
 * Helper: create engine args wrapping the injected Tone mock. The sampler is the
 * only sound source now, so there's no polyphony option to pass.
 */
const ENGINE_ARGS = (ToneMock: unknown) => ({
  Tone: ToneMock as unknown as typeof import('tone')
})

// ─── surface / backwards-compat tests ────────────────────────────────────────

describe('createQanunEngine — surface', () => {
  it('exposes the documented surface including holdStart/holdStop and P2 sampler methods', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (const fn of [
      'start', 'resume', 'dispose', 'pluck',
      'holdStart', 'holdAlternate', 'holdStop',
      'setReverbEnabled', 'setReverbWet', 'setReverbSize', 'getSampleRate',
      'getRecorderTap'
    ]) {
      expect(typeof (e as unknown as Record<string, unknown>)[fn]).toBe('function')
    }
    expect(e.isStarted).toBe(false)
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

// ─── resume (mobile app-switch recovery) ─────────────────────────────────────
// Backgrounding the tab suspends the AudioContext (iOS: "interrupted") and
// start() is latched — resume() is the re-unlock path on return to the
// foreground / the next gesture.

describe('createQanunEngine — resume', () => {
  it('is a no-op before start() — never unlocks without the first gesture', async () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    await e.resume()
    expect(ToneMock.start).not.toHaveBeenCalled()
    expect(e.isStarted).toBe(false)
  })

  it('re-unlocks a suspended context after start()', async () => {
    const base = makeMockTone()
    const ToneMock = {
      ...base.ToneMock,
      getContext: vi.fn(() => ({ sampleRate: 48000, state: 'suspended' }))
    }
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    await e.start()
    expect(ToneMock.start).toHaveBeenCalledTimes(1)
    await e.resume() // the app-switch left the context suspended
    expect(ToneMock.start).toHaveBeenCalledTimes(2)
  })

  it('skips the redundant unlock while the context is already running', async () => {
    const base = makeMockTone()
    const ToneMock = {
      ...base.ToneMock,
      getContext: vi.fn(() => ({ sampleRate: 48000, state: 'running' }))
    }
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    await e.start()
    await e.resume()
    await e.resume() // resume rides every pluck — it must stay cheap
    expect(ToneMock.start).toHaveBeenCalledTimes(1) // only the initial unlock
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
      Tone: toneNoLimiter as unknown as typeof import('tone')
    })
    expect(() => e.dispose()).not.toThrow()
    // getRecorderTap() returns the sumBus output (an object) without throwing.
    const e2 = createQanunEngine({
      Tone: { ...base.ToneMock, Limiter: undefined } as unknown as typeof import('tone')
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

// ─── triple-course pluck (v2 core feature) ────────────────────────────────────

describe('createQanunEngine — triple-course pluck', () => {
  it('one pluck() triggers exactly 3 sampler attacks at 3 detuned frequencies', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded() // strikes only sound once the sampler is loaded
    e.pluck({ freqHz: 440, velocity: 0.8 })

    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)

    const freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
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

  it('fires on-demand plucks at immediate() (no lookahead latency), not now()', () => {
    // Regression: an omitted time let Tone default to now() = currentTime +
    // lookAhead (~0.1 s), delaying every live note a full beat. A played pluck
    // must schedule at immediate() (raw context time) instead.
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    ToneMock.now = vi.fn(() => 99) // sentinel: now() must NOT be used for live strikes
    ToneMock.immediate = vi.fn(() => 0.25)
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.8 })

    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
    for (const call of samplerTriggerAttack.mock.calls) {
      expect(call[1]).toBe(0.25) // immediate(), never the 99 from now()
    }
  })

  it('ignores invalid frequencies', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded() // so an absence of attacks is meaningful, not just "unloaded"
    e.pluck({ freqHz: -1, velocity: 0.5 })
    e.pluck({ freqHz: 0, velocity: 0.5 })
    e.pluck({ freqHz: NaN, velocity: 0.5 })
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  // bloom:false is the engine's plain single-voice strike. The play paths no
  // longer pass it — strum/glide sweeps bloom exactly like a pluck (the master
  // limiter + soft-clip make the sum clip-proof) — but the option stays pinned
  // so a caller wanting an un-detuned single strike keeps getting one.
  it('pluck({ bloom: false }) fires a single voice at the exact frequency', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.8, bloom: false })
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(1)
    expect(samplerTriggerAttack.mock.calls[0][0] as number).toBeCloseTo(440, 5)
  })

  it('pluck() still blooms to 3 detuned voices by default', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.8 })
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
  })

  // The sampler is the only sound source — there's no synth fallback. A strike
  // issued BEFORE the sampler finishes loading is dropped (a beat of silence on
  // first launch), and only starts producing attacks once onload fires.
  it('drops strikes until the sampler loads, then fires sampler attacks', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    // Not loaded yet → pluck produces nothing (silence, not a synth fallback).
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
    // After onload → pluck fires the triple-course bloom on the sampler.
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
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
    // The rashsh rate is a fixed Hz (the shared tremolo pulse), independent of
    // the Transport BPM.
    expect(frequency).toBe(DEFAULT_TREMOLO_HZ)

    expect(loopStart).toHaveBeenCalledTimes(1)
  })

  it('holdStart() immediately plucks the note (3 attacks on first call)', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdStart({ freqHz: 440, velocity: 0.7 })
    // Immediate pluck = 3 attacks.
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
  })

  it('holdStart({ immediate: false }) does NOT fire the initial 3-voice attack but still starts the loop', () => {
    const { ToneMock, samplerTriggerAttack, loopStart, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    // No initial attack.
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
    // But the rashsh loop should still be created and started.
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    expect(loopStart).toHaveBeenCalledTimes(1)
  })

  it('blooms each single-note rashsh tick to the triple-course cluster (like a pluck)', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    callback(0)
    // A one-finger tremolo strike is the SAME event as a pluck (and as a trill
    // tick): the full 3-voice bloom hugging the held note. The old single-voice
    // strike is what made a held single note read soft and distant.
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
    const freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.findIndex((f) => Math.abs(f - 440) < 0.01)).toBeGreaterThanOrEqual(0)
    expect(freqs.every((f) => Math.abs(f - 440) < 3)).toBe(true)
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

// ─── setTremoloHz (user-tunable shared hold pulse) ───────────────────────────

describe('createQanunEngine — setTremoloHz', () => {
  it('retunes a RUNNING hold clock in place (no restart, no new clock)', () => {
    const { ToneMock, loopStop, loopDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const clock = ToneMock.Clock.mock.results[0].value as { frequency: { value: number } }
    e.setTremoloHz(12)
    // The live TickSignal is retuned — the grid never stops or stutters.
    expect(clock.frequency.value).toBe(12)
    expect(loopStop).not.toHaveBeenCalled()
    expect(loopDispose).not.toHaveBeenCalled()
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
  })

  it('applies to holds started after the change (single rashsh and trill alike)', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setTremoloHz(12)
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    expect(ToneMock.Clock.mock.calls[0][1]).toBe(12)
    e.holdStop()
    // Both hold shapes ride the SAME pulse — the trill alternates at it too.
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    expect(ToneMock.Clock.mock.calls[1][1]).toBe(12)
  })

  it('clamps to the playable range and ignores non-finite input', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const clock = ToneMock.Clock.mock.results[0].value as { frequency: { value: number } }
    e.setTremoloHz(1000)
    expect(clock.frequency.value).toBe(TREMOLO_HZ_MAX)
    e.setTremoloHz(0)
    expect(clock.frequency.value).toBe(TREMOLO_HZ_MIN)
    e.setTremoloHz(NaN)
    expect(clock.frequency.value).toBe(TREMOLO_HZ_MIN) // unchanged
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
    const { ToneMock, loopStart, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    const [callback, frequency] = ToneMock.Clock.mock.calls[0]
    expect(typeof callback).toBe('function')
    // The alternation ticks at the SAME pulse as the single-string trill:
    // one pluck-weight note per tick, hi-lo-hi-lo, so each note is a distinct
    // event (like fast manual alternate plucking). At 2× the strikes land
    // faster than the ~1.5 s ring decays on either string, and the pair fuses
    // into a continuous octave dyad — it reads as unison, not a trill.
    expect(frequency).toBe(DEFAULT_TREMOLO_HZ)
    expect(loopStart).toHaveBeenCalledTimes(1)
    // No initial pluck — the caller already plucked.
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  it('alternates through freqs in order, starting with the first (higher) entry', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    // Drive the captured loop callback tick-by-tick.
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void

    // Tick 0 → freqs[0] = 660 (the higher note sounds first).
    samplerTriggerAttack.mockClear()
    callback(0)
    let freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false)

    // Tick 1 → freqs[1] = 440.
    samplerTriggerAttack.mockClear()
    callback(0.1)
    freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(false)

    // Tick 2 → wraps back to freqs[0] = 660.
    samplerTriggerAttack.mockClear()
    callback(0.2)
    freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
  })

  it('blooms each trill tick to the triple-course cluster (like a pluck)', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    callback(0)
    // Each strike fires the full 3-voice triple-course bloom (a click/pluck does
    // the same) — that body + shimmer is what makes the trill read like fast
    // plucking instead of a thin, quiet seesaw. All three sit around the active
    // note (660), detuned by COURSE_CENTS, with one exactly on pitch.
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
    const freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.findIndex((f) => Math.abs(f - 660) < 0.01)).toBeGreaterThanOrEqual(0)
    expect(freqs.every((f) => Math.abs(f - 660) < 3)).toBe(true) // whole cluster hugs 660
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false) // the low string is silent this tick
  })

  // 1↔2 transitions must stay on ONE persistent clock. The old design tore the
  // rashsh loop down and started a separate trill clock — and a fresh Tone.Clock
  // fires its first tick AT start, so the trill's opening strike landed 0–111 ms
  // after the rashsh's last one depending on WHEN the second finger pinched:
  // entries read as flams or near-unison. Sharing the clock removes that timing
  // dependency entirely.
  it('1→2 rides the same clock: no teardown, no second clock, no immediate re-fire', () => {
    const { ToneMock, loopStop, loopDispose, loopStart, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1) // single rashsh
    samplerTriggerAttack.mockClear()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    // Same clock keeps running — nothing stopped, nothing new started, and no
    // out-of-grid strike fired at the transition itself.
    expect(loopStop).not.toHaveBeenCalled()
    expect(loopDispose).not.toHaveBeenCalled()
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    expect(loopStart).toHaveBeenCalledTimes(1)
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
    // Sliding while trilling retunes in place — still the same loop.
    e.holdAlternate({ freqs: [660, 450], velocity: 0.7 })
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
  })

  // The two-note trill must sound IDENTICAL regardless of when each finger landed:
  // on the count change it re-leads with the higher note (freqs[0]), no matter
  // what internal phase the single-note hold had reached.
  it('the trill always leads with the higher note, regardless of prior single-note phase', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    // Hold the LOWER note alone; run the shared loop to an odd internal phase.
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const cb = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    cb(0)   // tick 0
    cb(0.1) // tick 1
    cb(0.2) // tick 2 → internal counter now odd
    // Add the HIGHER note → same clock, but the alternation re-leads high.
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    samplerTriggerAttack.mockClear()
    cb(0.3) // first two-note tick
    const freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)  // higher leads
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false) // not the lower
  })

  // ...and the mirror ordering: when the HIGHER note was held first, the pair
  // still leads high — which finger pinched first cannot change the figure.
  it('the trill leads with the higher note when the higher note was held first too', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdStart({ freqHz: 660, velocity: 0.7, immediate: false })
    const cb = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    cb(0); cb(0.1); cb(0.2) // odd internal phase again
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    samplerTriggerAttack.mockClear()
    cb(0.3)
    const freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 440) < 1)).toBe(false)
  })

  // Lifting one finger of a trill returns cleanly to the single-note tremolo —
  // on the SAME grid (the surviving note simply takes every tick).
  it('2→1 rides the same clock: the survivor takes the next tick as a single rashsh', () => {
    const { ToneMock, loopStop, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const cb = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    cb(0) // hi strikes once
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false }) // one finger lifted
    expect(loopStop).not.toHaveBeenCalled()         // grid never restarts
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1) // still the one shared clock
    samplerTriggerAttack.mockClear()
    cb(0.1)
    // The survivor's strike is the same bloomed event as any other hold tick
    // (3-voice cluster hugging the held note) — only the alternation stopped.
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
    const survivorFreqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(survivorFreqs.every((f) => Math.abs(f - 440) < 3)).toBe(true)
    expect(survivorFreqs.some((f) => Math.abs(f - 660) < 1)).toBe(false)
  })

  // Pinch-detection flapping ({A} ↔ {A,B} on alternating frames) was the worst
  // real-world failure: every flap used to restart a clock and double-fire both
  // notes nearly simultaneously — "tremolo in unison". Flaps must neither add
  // strikes nor touch the clock.
  it('hold-set flapping never restarts the clock or fires transition strikes', () => {
    const { ToneMock, loopStop, loopDispose, loopStart, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded() // loaded, so the absence of strikes is meaningful
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    for (let i = 0; i < 5; i++) {
      e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
      e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    }
    expect(ToneMock.Clock).toHaveBeenCalledTimes(1)
    expect(loopStart).toHaveBeenCalledTimes(1)
    expect(loopStop).not.toHaveBeenCalled()
    expect(loopDispose).not.toHaveBeenCalled()
    // Strikes come ONLY from clock ticks — the flapping itself stays silent.
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  // Phase resets only on a COUNT change (note added/removed), not when a held
  // note's pitch shifts — so a jittering held course can't restart the trill.
  it('does not reset the alternation phase when a held note shifts pitch (count unchanged)', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    callback(0) // tick 0 → 660 (internal counter → 1)
    // One held note jitters 440 → 450 (same count) — must NOT reset to tick 0.
    e.holdAlternate({ freqs: [660, 450], velocity: 0.7 })
    samplerTriggerAttack.mockClear()
    callback(0.05) // continues at tick 1 → the LOWER note (450), not a reset to 660
    const freqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(freqs.some((f) => Math.abs(f - 450) < 1)).toBe(true)
    expect(freqs.some((f) => Math.abs(f - 660) < 1)).toBe(false)
  })

  // Independent strings: each tick simply triggers a fresh sampler attack on the
  // struck note — the other octave is never closed/silenced, so both rings
  // overlap naturally until re-struck (the sampler has no per-voice gate).
  it('never silences the other octave: a tick only attacks the struck note', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    callback(0); callback(0.1); callback(0.2) // hi, lo, hi
    // 3 ticks × 3-voice bloom = 9 attacks, each a strike on the active note;
    // the unstruck octave is never released, so it keeps ringing untouched.
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(9)
  })

  it('releasing the trill lets the strings ring out (no release on holdStop)', () => {
    const { ToneMock, samplerTriggerRelease, loopStop, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    callback(0)
    samplerTriggerRelease.mockClear()
    e.holdStop()
    expect(loopStop).toHaveBeenCalledTimes(1)            // the loop stops...
    expect(samplerTriggerRelease).not.toHaveBeenCalled() // ...but nothing is muted
  })

  // The trill strikes the sampled voice — there is no synth fallback, so before
  // the sampler loads its ticks are silent, and after onload they fire.
  it('strikes the sampled voice once the sampler loads', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.holdAlternate({ freqs: [660, 440], velocity: 0.7 })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    // Sampler not loaded yet → the tick is dropped (silence, no synth fallback).
    samplerTriggerAttack.mockClear()
    callback(0)
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
    // Once loaded, the tick fires the sampled strike, bloomed.
    simulateSamplerLoaded()
    samplerTriggerAttack.mockClear()
    callback(0.1)
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3) // sampled strike, bloomed
    const loFreqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    // After one prior (dropped) tick the cursor advanced, so this tick is the
    // LOWER note — the alternation runs on the sampled voice.
    expect(loFreqs.some((f) => Math.abs(f - 440) < 1)).toBe(true)
    // And it keeps alternating on the sampled voice.
    samplerTriggerAttack.mockClear()
    callback(0.2)
    const hiFreqs = samplerTriggerAttack.mock.calls.map((c) => c[0] as number)
    expect(hiFreqs.some((f) => Math.abs(f - 660) < 1)).toBe(true)
  })

  it('single-note hold fires a fresh strike every tick (it never goes silent)', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdStart({ freqHz: 440, velocity: 0.7, immediate: false })
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    callback(0); callback(0.1); callback(0.2) // same pitch repeated
    // Every tick re-strikes the held note (3-voice bloom); nothing is gated off.
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(9)
    expect(samplerTriggerAttack.mock.calls.every((c) => Math.abs((c[0] as number) - 440) < 3)).toBe(true)
  })

  it('filters out non-finite freqs (the loop only plays valid notes)', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.holdAlternate({ freqs: [NaN, 440], velocity: 0.7 }) // NaN filtered → only 440 held
    const callback = ToneMock.Clock.mock.calls[0][0] as (t: number) => void
    samplerTriggerAttack.mockClear()
    expect(() => callback(0)).not.toThrow()
    // Every tick plays the one valid note (one bloomed strike = 3 attacks).
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
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

  it('defaults to isSampleLoaded=false before onload fires', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
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

// ─── P2: sampler strikes (the only sound source) ─────────────────────────────

describe('createQanunEngine — sampler strikes', () => {
  it('pluck() produces no attacks until the sampler is loaded (no synth fallback)', () => {
    const { ToneMock, samplerTriggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    // Default: sampler not loaded → strike is dropped (silence, never a synth).
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(samplerTriggerAttack).not.toHaveBeenCalled()
  })

  it('pluck() uses the sampler once it is loaded', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.7 })
    expect(samplerTriggerAttack).toHaveBeenCalled()  // sampler fired
  })

  it('pluck() fires sampler 3× (triple-course) when loaded', () => {
    const { ToneMock, samplerTriggerAttack, simulateSamplerLoaded } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    simulateSamplerLoaded()
    e.pluck({ freqHz: 440, velocity: 0.8 })
    // 3 detuned attacks on the sampler
    expect(samplerTriggerAttack).toHaveBeenCalledTimes(3)
  })

  it('dispose() disposes the sampler and chorus', () => {
    const { ToneMock, samplerDispose, chorusDispose } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.dispose()
    expect(samplerDispose).toHaveBeenCalledTimes(1)
    expect(chorusDispose).toHaveBeenCalledTimes(1)
  })
})
