import { describe, it, expect, vi, beforeEach } from 'vitest'
import { __testOnly_appendSamples, __testOnly_createRingBuffer } from '../createRecorder'

describe('createRecorder ring buffer (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('appends mono samples up to the cap and reports cap reached', () => {
    const buf = __testOnly_createRingBuffer({ channelCount: 1, capacityFrames: 10 })
    const overflowSpy = vi.fn()
    const ch0 = new Float32Array([0.1, 0.2, 0.3, 0.4])
    const result1 = __testOnly_appendSamples(buf, [ch0], overflowSpy)
    expect(result1.lengthFrames).toBe(4)
    expect(overflowSpy).not.toHaveBeenCalled()

    // Append 5 more — total 9, still under cap.
    const ch1 = new Float32Array([0.5, 0.6, 0.7, 0.8, 0.9])
    const result2 = __testOnly_appendSamples(buf, [ch1], overflowSpy)
    expect(result2.lengthFrames).toBe(9)
    expect(overflowSpy).not.toHaveBeenCalled()

    // Append 5 more — would push to 14, must clamp to 10 and call overflow.
    const ch2 = new Float32Array([1.0, 1.1, 1.2, 1.3, 1.4])
    const result3 = __testOnly_appendSamples(buf, [ch2], overflowSpy)
    expect(result3.lengthFrames).toBe(10)
    expect(result3.overflowed).toBe(true)
    expect(overflowSpy).toHaveBeenCalledTimes(1)

    // First 10 frames are the first 10 values written. Values are stored in
    // a Float32Array so we compare against the float32-truncated form of the
    // expected literals (otherwise 0.1 → 0.10000000149... mismatches).
    expect(Array.from(buf.channels[0].slice(0, 10))).toEqual(
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((n) => Math.fround(n))
    )
  })

  it('appends stereo samples in lockstep across channels', () => {
    const buf = __testOnly_createRingBuffer({ channelCount: 2, capacityFrames: 5 })
    const overflowSpy = vi.fn()
    const left = new Float32Array([1, 2, 3])
    const right = new Float32Array([-1, -2, -3])
    const result = __testOnly_appendSamples(buf, [left, right], overflowSpy)
    expect(result.lengthFrames).toBe(3)
    expect(Array.from(buf.channels[0].slice(0, 3))).toEqual([1, 2, 3])
    expect(Array.from(buf.channels[1].slice(0, 3))).toEqual([-1, -2, -3])
  })

  it('does not call overflow more than once even with continued appends', () => {
    const buf = __testOnly_createRingBuffer({ channelCount: 1, capacityFrames: 3 })
    const overflowSpy = vi.fn()
    __testOnly_appendSamples(buf, [new Float32Array([1, 2, 3, 4])], overflowSpy)
    __testOnly_appendSamples(buf, [new Float32Array([5, 6])], overflowSpy)
    expect(overflowSpy).toHaveBeenCalledTimes(1)
  })
})
