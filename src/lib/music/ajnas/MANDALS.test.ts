import { describe, expect, it } from 'vitest'
import {
  DEGREE_COUNT,
  DEFAULT_RAST_STATE,
  MANDAL_DEGREES,
  cycleMandal,
  offsetOf,
  positionsForDegree,
  setMandal
} from './MANDALS'

describe('MANDAL_DEGREES (docs/MUSIC-THEORY.md §5)', () => {
  it('has 7 degrees with the spec position sets', () => {
    expect(DEGREE_COUNT).toBe(7)
    expect(positionsForDegree(1)).toEqual([0])
    expect(positionsForDegree(2)).toEqual([1, 1.5, 2])
    expect(positionsForDegree(3)).toEqual([3, 3.5, 4])
    expect(positionsForDegree(4)).toEqual([4, 5, 6])
    expect(positionsForDegree(5)).toEqual([7])
    expect(positionsForDegree(6)).toEqual([8, 8.5, 9])
    expect(positionsForDegree(7)).toEqual([10, 10.5, 11])
  })

  it('marks degrees 1 and 5 as fixed pillars', () => {
    expect(MANDAL_DEGREES[0].fixed).toBe(true)
    expect(MANDAL_DEGREES[4].fixed).toBe(true)
    expect(MANDAL_DEGREES[1].fixed).toBe(false)
  })
})

describe('DEFAULT_RAST_STATE', () => {
  it('is Rast on the tonic: [0, 2, 3.5, 5, 7, 9, 10.5]', () => {
    expect(DEFAULT_RAST_STATE).toEqual([0, 2, 3.5, 5, 7, 9, 10.5])
    expect(DEFAULT_RAST_STATE).toHaveLength(7)
  })
  it('every default offset is a legal position for its degree', () => {
    for (let d = 1; d <= 7; d++) {
      expect(positionsForDegree(d)).toContain(offsetOf(DEFAULT_RAST_STATE, d))
    }
  })
})

describe('offsetOf', () => {
  it('reads the chosen offset for a degree (1-indexed)', () => {
    expect(offsetOf(DEFAULT_RAST_STATE, 1)).toBe(0)
    expect(offsetOf(DEFAULT_RAST_STATE, 3)).toBe(3.5)
    expect(offsetOf(DEFAULT_RAST_STATE, 7)).toBe(10.5)
  })
})

describe('setMandal', () => {
  it('returns a new state with one degree changed', () => {
    const next = setMandal(DEFAULT_RAST_STATE, 3, 3)
    expect(offsetOf(next, 3)).toBe(3)
    expect(next).not.toBe(DEFAULT_RAST_STATE)         // immutable
    expect(offsetOf(DEFAULT_RAST_STATE, 3)).toBe(3.5) // original untouched
  })
})

describe('cycleMandal', () => {
  it('moves the degree to the next higher position', () => {
    // degree 3 default 3.5 → next up is 4 (natural).
    expect(offsetOf(cycleMandal(DEFAULT_RAST_STATE, 3, 1), 3)).toBe(4)
  })
  it('moves the degree to the next lower position', () => {
    // degree 3 default 3.5 → next down is 3 (flat).
    expect(offsetOf(cycleMandal(DEFAULT_RAST_STATE, 3, -1), 3)).toBe(3)
  })
  it('clamps at the top and bottom of a degree (no wrap)', () => {
    const top = setMandal(DEFAULT_RAST_STATE, 2, 2)      // degree 2 highest
    expect(offsetOf(cycleMandal(top, 2, 1), 2)).toBe(2)  // stays at 2
    const bottom = setMandal(DEFAULT_RAST_STATE, 2, 1)   // degree 2 lowest
    expect(offsetOf(cycleMandal(bottom, 2, -1), 2)).toBe(1)
  })
  it('is a no-op on fixed pillar degrees 1 and 5', () => {
    expect(cycleMandal(DEFAULT_RAST_STATE, 1, 1)).toEqual(DEFAULT_RAST_STATE)
    expect(cycleMandal(DEFAULT_RAST_STATE, 5, -1)).toEqual(DEFAULT_RAST_STATE)
  })
})
