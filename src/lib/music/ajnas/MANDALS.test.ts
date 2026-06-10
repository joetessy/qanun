import { describe, expect, it } from 'vitest'
import {
  DEGREE_COUNT,
  DEFAULT_RAST_STATE,
  MANDAL_DEGREES,
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
    expect(positionsForDegree(5)).toEqual([6, 6.5, 7])
    expect(positionsForDegree(6)).toEqual([8, 8.5, 9])
    expect(positionsForDegree(7)).toEqual([10, 10.5, 11])
  })

  it('marks only degree 1 as a fixed pillar', () => {
    expect(MANDAL_DEGREES[0].fixed).toBe(true)   // degree 1 — tonic, immovable
    expect(MANDAL_DEGREES[4].fixed).toBe(false)  // degree 5 — now variable
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
