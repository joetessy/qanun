import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMetronome } from './createMetronome'

interface MockTransport {
  bpm: { value: number }
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  scheduleRepeat: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  position: string
}

const makeMockTone = () => {
  const transport: MockTransport = {
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    scheduleRepeat: vi.fn().mockReturnValue(42),
    clear: vi.fn(),
    position: '0:0:0'
  }
  const gainNode = { gain: { rampTo: vi.fn(), value: 0 }, connect: vi.fn(), dispose: vi.fn() }
  const oscNode = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn()
  }
  const envNode = {
    gain: {
      rampTo: vi.fn(),
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    },
    connect: vi.fn(),
    dispose: vi.fn()
  }
  const ToneMock = {
    getTransport: vi.fn(() => transport),
    Gain: vi.fn().mockImplementation(() => {
      // First Gain allocation = output gain bus; subsequent are per-click envelopes.
      const calls = ToneMock.Gain.mock.calls.length
      return calls === 1 ? gainNode : envNode
    }),
    Oscillator: vi.fn().mockImplementation(() => oscNode),
    start: vi.fn().mockResolvedValue(undefined)
  }
  return { ToneMock, transport, gainNode }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('createMetronome', () => {
  it('writes the initial BPM to Transport on construction', () => {
    const { ToneMock, transport } = makeMockTone()
    createMetronome({
      Tone: ToneMock as never,
      output: {} as never,
      initialBpm: 96,
      onClick: vi.fn()
    })
    expect(transport.bpm.value).toBe(96)
  })

  it('setBpm clamps to [30, 300] and writes to Transport', () => {
    const { ToneMock, transport } = makeMockTone()
    const metro = createMetronome({
      Tone: ToneMock as never,
      output: {} as never,
      initialBpm: 120,
      onClick: vi.fn()
    })
    metro.setBpm(150)
    expect(transport.bpm.value).toBe(150)
    metro.setBpm(9999)
    expect(transport.bpm.value).toBe(300)
    metro.setBpm(-50)
    expect(transport.bpm.value).toBe(30)
  })

  it('on enable, schedules a quarter-note repeat and starts Transport', async () => {
    const { ToneMock, transport } = makeMockTone()
    const metro = createMetronome({
      Tone: ToneMock as never,
      output: {} as never,
      initialBpm: 120,
      onClick: vi.fn()
    })
    await metro.setEnabled(true)
    expect(transport.scheduleRepeat).toHaveBeenCalledTimes(1)
    const [callback, interval] = transport.scheduleRepeat.mock.calls[0]
    expect(typeof callback).toBe('function')
    expect(interval).toBe('4n')
    expect(transport.start).toHaveBeenCalledTimes(1)
  })

  it('on disable, clears the scheduled event but leaves the shared Transport running', async () => {
    const { ToneMock, transport } = makeMockTone()
    const metro = createMetronome({
      Tone: ToneMock as never,
      output: {} as never,
      initialBpm: 120,
      onClick: vi.fn()
    })
    await metro.setEnabled(true)
    await metro.setEnabled(false)
    expect(transport.clear).toHaveBeenCalledWith(42)
    // The rashsh sustain loop shares the global transport, so disabling the
    // metronome must NOT stop it.
    expect(transport.stop).not.toHaveBeenCalled()
  })

  it('does not schedule the metronome if disable races past an in-flight enable', async () => {
    const { ToneMock, transport } = makeMockTone()
    let resolveStart: () => void = () => {}
    ToneMock.start = vi.fn(() => new Promise<void>((r) => { resolveStart = r }))

    const metro = createMetronome({
      Tone: ToneMock as never,
      output: {} as never,
      initialBpm: 120,
      onClick: vi.fn()
    })
    const p = metro.setEnabled(true)
    await metro.setEnabled(false)
    resolveStart()
    await p
    expect(transport.scheduleRepeat).not.toHaveBeenCalled()
    expect(transport.start).not.toHaveBeenCalled()
  })

  it('emits onClick with isDownbeat=true on beat 1 and false on beats 2–4 (4/4)', async () => {
    const { ToneMock, transport } = makeMockTone()
    const onClick = vi.fn()
    const metro = createMetronome({
      Tone: ToneMock as never,
      output: {} as never,
      initialBpm: 120,
      onClick
    })
    await metro.setEnabled(true)
    const [scheduledCb] = transport.scheduleRepeat.mock.calls[0] as [(t: number) => void]
    // Simulate four ticks: the metronome internally tracks a 4/4 beat counter
    // starting at 0 → beat 1 is downbeat, beats 2-4 are offbeat.
    scheduledCb(0)
    scheduledCb(0.5)
    scheduledCb(1.0)
    scheduledCb(1.5)
    expect(onClick).toHaveBeenCalledTimes(4)
    expect(onClick.mock.calls[0][0]).toEqual({ time: 0, isDownbeat: true })
    expect(onClick.mock.calls[1][0]).toEqual({ time: 0.5, isDownbeat: false })
    expect(onClick.mock.calls[2][0]).toEqual({ time: 1.0, isDownbeat: false })
    expect(onClick.mock.calls[3][0]).toEqual({ time: 1.5, isDownbeat: false })
    // Fifth tick wraps back to downbeat.
    scheduledCb(2.0)
    expect(onClick.mock.calls[4][0]).toEqual({ time: 2.0, isDownbeat: true })
  })
})
