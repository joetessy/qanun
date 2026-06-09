import { describe, expect, it } from 'vitest'
import { velocityCurve } from './velocityCurve'

describe('velocityCurve', () => {
  it('maps 0 → min and 1 → max', () => {
    expect(velocityCurve(0)).toBeCloseTo(0.15, 6)        // default floor
    expect(velocityCurve(1)).toBeCloseTo(1, 6)
  })
  it('is monotonic increasing', () => {
    let prev = -1
    for (let s = 0; s <= 1.0001; s += 0.1) {
      const v = velocityCurve(s)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('clamps out-of-range speed', () => {
    expect(velocityCurve(-5)).toBeCloseTo(0.15, 6)
    expect(velocityCurve(5)).toBeCloseTo(1, 6)
  })
  it('respects custom min/max/gamma', () => {
    expect(velocityCurve(0, { min: 0.3, max: 0.9 })).toBeCloseTo(0.3, 6)
    expect(velocityCurve(1, { min: 0.3, max: 0.9 })).toBeCloseTo(0.9, 6)
  })
})
