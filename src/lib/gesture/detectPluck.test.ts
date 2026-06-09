import { describe, expect, it } from 'vitest'
import { createPluckDetector } from './detectPluck'

describe('createPluckDetector — pinch onset edge', () => {
  it('emits one pluck on the open→closed transition, sampling the course at onset', () => {
    const d = createPluckDetector()
    expect(d.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0.0 })).toBeNull() // open
    const ev = d.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.05 })        // closed
    expect(ev).not.toBeNull()
    expect(ev!.courseIndex).toBe(5) // sampled at the onset frame
  })

  it('does NOT re-emit while the pinch stays closed', () => {
    const d = createPluckDetector()
    d.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })
    expect(d.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 })).not.toBeNull()
    expect(d.update({ pinchDist: 0.01, courseIndex: 3, tNow: 0.10 })).toBeNull()
    expect(d.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.15 })).toBeNull()
  })

  it('re-arms after the pinch opens past the hysteresis threshold', () => {
    const d = createPluckDetector()
    d.update({ pinchDist: 0.12, courseIndex: 1, tNow: 0 })
    expect(d.update({ pinchDist: 0.02, courseIndex: 1, tNow: 0.05 })).not.toBeNull()
    d.update({ pinchDist: 0.12, courseIndex: 1, tNow: 0.10 }) // open again
    expect(d.update({ pinchDist: 0.02, courseIndex: 1, tNow: 0.15 })).not.toBeNull()
  })

  it('derives a higher velocity from a faster close, clamped to [0,1]', () => {
    const slow = createPluckDetector()
    slow.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    const slowEv = slow.update({ pinchDist: 0.04, courseIndex: 0, tNow: 0.20 })
    const fast = createPluckDetector()
    fast.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    const fastEv = fast.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.02 })
    expect(fastEv!.velocity).toBeGreaterThan(slowEv!.velocity)
    expect(fastEv!.velocity).toBeLessThanOrEqual(1)
    expect(slowEv!.velocity).toBeGreaterThan(0)
  })

  it('reset() clears the pinch state', () => {
    const d = createPluckDetector()
    d.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0 }) // starts closed → no prior open, no emit
    d.reset()
    d.update({ pinchDist: 0.12, courseIndex: 2, tNow: 0.05 })
    expect(d.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.10 })).not.toBeNull()
  })
})
