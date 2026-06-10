import { describe, expect, it, vi } from 'vitest'
import { createDrone } from './createDrone'

describe('createDrone', () => {
  const makeMockTone = () => {
    const freqRampTo = vi.fn()
    const gainRampTo = vi.fn()
    const oscStart = vi.fn()
    const oscStop = vi.fn()
    const oscDispose = vi.fn()
    const gainDispose = vi.fn()
    const gainConnect = vi.fn()

    const ToneMock = {
      Oscillator: vi.fn().mockImplementation((opts: { type: string; frequency: number }) => ({
        type: opts.type,
        frequency: { rampTo: freqRampTo, value: opts.frequency },
        start: oscStart,
        stop: oscStop,
        dispose: oscDispose,
        connect: (target: unknown) => target
      })),
      Gain: vi.fn().mockImplementation((value: number) => ({
        gain: { rampTo: gainRampTo, value },
        connect: gainConnect,
        dispose: gainDispose
      })),
      start: vi.fn().mockResolvedValue(undefined)
    }

    return { ToneMock, freqRampTo, gainRampTo, oscStart, oscStop, oscDispose, gainDispose, gainConnect }
  }

  it('retunes the oscillator when tonic changes', () => {
    const { ToneMock, freqRampTo } = makeMockTone()
    const drone = createDrone({
      Tone: ToneMock as unknown as typeof import('tone'),
      output: {} as never,
      initialTonicMidi: 60
    })
    // Initial freq is set at construction → MIDI 60 → ~261.63 Hz.
    expect(freqRampTo).toHaveBeenLastCalledWith(expect.closeTo(261.6256, 3), expect.any(Number))

    drone.setTonic(69) // A4 = 440 Hz
    expect(freqRampTo).toHaveBeenLastCalledWith(expect.closeTo(440, 3), expect.any(Number))

    drone.setTonic(72) // C5 = ~523.25 Hz
    expect(freqRampTo).toHaveBeenLastCalledWith(expect.closeTo(523.2511, 3), expect.any(Number))
  })

  it('starts the oscillator only on first enable', async () => {
    const { ToneMock, oscStart, gainRampTo } = makeMockTone()
    const drone = createDrone({
      Tone: ToneMock as unknown as typeof import('tone'),
      output: {} as never,
      initialTonicMidi: 60
    })
    expect(oscStart).not.toHaveBeenCalled()
    await drone.setEnabled(true)
    expect(oscStart).toHaveBeenCalledTimes(1)
    await drone.setEnabled(false)
    await drone.setEnabled(true)
    // Still only started once — second enable just ramps gain back up.
    expect(oscStart).toHaveBeenCalledTimes(1)
    // Gain ramps: 0 (initial) → target on enable, → 0 on disable, → target on re-enable.
    const lastGain = gainRampTo.mock.calls.at(-1)?.[0]
    expect(lastGain).toBeGreaterThan(0)
  })

  it('disposes underlying nodes', () => {
    const { ToneMock, oscDispose, gainDispose } = makeMockTone()
    const drone = createDrone({
      Tone: ToneMock as unknown as typeof import('tone'),
      output: {} as never,
      initialTonicMidi: 60
    })
    drone.dispose()
    expect(oscDispose).toHaveBeenCalledTimes(1)
    expect(gainDispose).toHaveBeenCalledTimes(1)
  })

  it('does not start the oscillator if disable races past an in-flight enable', async () => {
    const { ToneMock, oscStart } = makeMockTone()
    // Make Tone.start() actually take a tick to resolve so we can race it.
    let resolveStart: () => void = () => {}
    ToneMock.start = vi.fn(() => new Promise<void>((r) => { resolveStart = r }))

    const drone = createDrone({
      Tone: ToneMock as unknown as typeof import('tone'),
      output: {} as never,
      initialTonicMidi: 60
    })
    // Inflight enable; then immediately disable.
    const p = drone.setEnabled(true)
    drone.setEnabled(false)
    // Now let Tone.start() complete — the enable should bail.
    resolveStart()
    await p
    expect(oscStart).not.toHaveBeenCalled()
  })
})
