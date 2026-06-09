import { describe, expect, it } from 'vitest'
import {
  MANDAL_ZONE_RIGHT,
  isInMandalZone,
  mandalLeverFromY,
  createMandalGesture
} from './detectMandal'

describe('isInMandalZone', () => {
  it('is true in the far-left strip, false in the play field', () => {
    expect(isInMandalZone(0.05)).toBe(true)
    expect(isInMandalZone(MANDAL_ZONE_RIGHT - 0.001)).toBe(true)
    expect(isInMandalZone(0.5)).toBe(false)
  })
})

describe('mandalLeverFromY', () => {
  it('maps the bottom of the zone to degree 1 and the top to degree 7', () => {
    expect(mandalLeverFromY(0.98)).toBe(1) // bottom → low degree
    expect(mandalLeverFromY(0.02)).toBe(7) // top → high degree
  })
  it('partitions y into 7 contiguous lever bands', () => {
    const degrees = [0.07, 0.21, 0.35, 0.5, 0.64, 0.78, 0.92].map((y) => mandalLeverFromY(y))
    expect(degrees).toEqual([7, 6, 5, 4, 3, 2, 1])
  })
  it('clamps out-of-range y to degrees 7 and 1', () => {
    expect(mandalLeverFromY(-1)).toBe(7)
    expect(mandalLeverFromY(2)).toBe(1)
  })
})

describe('createMandalGesture — vertical flick', () => {
  const open = 0.12
  it('emits a RAISE (+1) on a fast upward flick, tagged with the lever degree', () => {
    const g = createMandalGesture()
    // Finger inside the degree-3 band (y∈[0.571,0.714)), flicking up fast.
    expect(g.update({ x: 0.05, y: 0.68, pinchDist: open, tNow: 0 })).toBeNull()
    const ev = g.update({ x: 0.05, y: 0.60, pinchDist: open, tNow: 0.04 })
    expect(ev).toEqual({ degree: 3, direction: 1 })
  })

  it('emits a LOWER (−1) on a fast downward flick', () => {
    const g = createMandalGesture()
    // Finger inside the degree-4 band (y∈[0.429,0.571)), flicking down fast.
    g.update({ x: 0.05, y: 0.48, pinchDist: open, tNow: 0 })
    const ev = g.update({ x: 0.05, y: 0.56, pinchDist: open, tNow: 0.04 })
    expect(ev).toEqual({ degree: 4, direction: -1 })
  })

  it('ignores slow vertical drift (repositioning between levers)', () => {
    const g = createMandalGesture()
    g.update({ x: 0.05, y: 0.5, pinchDist: open, tNow: 0 })
    expect(g.update({ x: 0.05, y: 0.42, pinchDist: open, tNow: 0.8 })).toBeNull()
  })

  it('debounces — one flick does not retrigger until motion settles', () => {
    const g = createMandalGesture()
    g.update({ x: 0.05, y: 0.68, pinchDist: open, tNow: 0 })
    expect(g.update({ x: 0.05, y: 0.60, pinchDist: open, tNow: 0.04 })).not.toBeNull()
    // Still coasting upward fast — must not fire a second time immediately.
    expect(g.update({ x: 0.05, y: 0.52, pinchDist: open, tNow: 0.08 })).toBeNull()
  })

  it('pinch-to-cycle fallback: a pinch onset on a lever raises it (+1)', () => {
    const g = createMandalGesture()
    g.update({ x: 0.05, y: 0.21, pinchDist: 0.12, tNow: 0 }) // open on degree-6 band
    const ev = g.update({ x: 0.05, y: 0.21, pinchDist: 0.02, tNow: 0.05 })
    expect(ev).toEqual({ degree: 6, direction: 1 })
  })
})
