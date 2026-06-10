import { describe, expect, it } from 'vitest'
import { extrapolateTip } from './extrapolateTip'

describe('extrapolateTip', () => {
  it('pushes the tip outward along the ip→tip direction', () => {
    const out = extrapolateTip({ tip: { x: 0.5, y: 0.5 }, ip: { x: 0.4, y: 0.6 }, k: 0.25 })
    expect(out.x).toBeCloseTo(0.525)
    expect(out.y).toBeCloseTo(0.475)
  })

  it('k = 0 is the identity', () => {
    const out = extrapolateTip({ tip: { x: 0.3, y: 0.7 }, ip: { x: 0.1, y: 0.9 }, k: 0 })
    expect(out.x).toBeCloseTo(0.3)
    expect(out.y).toBeCloseTo(0.7)
  })

  it('defaults k to the thumb extrapolation constant (0.25)', () => {
    const out = extrapolateTip({ tip: { x: 0.5, y: 0.5 }, ip: { x: 0.5, y: 0.7 } })
    expect(out.x).toBeCloseTo(0.5)
    expect(out.y).toBeCloseTo(0.45)
  })
})
