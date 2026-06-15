import { describe, expect, it } from 'vitest'
import {
  DEGREE_COUNT,
  DEFAULT_RAST_STATE,
  MAJOR_STATE,
  MANDAL_DEGREES,
  stepMandalPosition,
  offsetOf,
  positionsForDegree,
  setMandal
} from './MANDALS'

describe('MANDAL_DEGREES (docs/MUSIC-THEORY.md §5)', () => {
  it('has 7 degrees with the full-coverage position sets', () => {
    expect(DEGREE_COUNT).toBe(7)
    expect(positionsForDegree(1)).toEqual([0, 0.5, 1])
    expect(positionsForDegree(2)).toEqual([1, 1.5, 2, 2.5, 3])
    expect(positionsForDegree(3)).toEqual([3, 3.5, 4, 4.5])
    expect(positionsForDegree(4)).toEqual([4.5, 5, 5.5, 6])
    expect(positionsForDegree(5)).toEqual([6, 6.5, 7, 7.5, 8])
    expect(positionsForDegree(6)).toEqual([8, 8.5, 9, 9.5, 10])
    expect(positionsForDegree(7)).toEqual([10, 10.5, 11, 11.5])
  })

  it('together the seven courses reach all 24 quarter-tones (any maqam, any root)', () => {
    const reachable = new Set<number>()
    for (const { positions } of MANDAL_DEGREES) {
      for (const p of positions) reachable.add(((p % 12) + 12) % 12)
    }
    for (let q = 0; q < 24; q++) {
      expect(reachable.has(q / 2)).toBe(true) // 0, 0.5, 1, … 11.5
    }
    expect(reachable.size).toBe(24)
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

describe('MAJOR_STATE', () => {
  it('is the major scale on the tonic: [0, 2, 4, 5, 7, 9, 11]', () => {
    expect(MAJOR_STATE).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(MAJOR_STATE).toHaveLength(7)
  })
  it('every major offset is a legal position for its degree', () => {
    for (let d = 1; d <= 7; d++) {
      expect(positionsForDegree(d)).toContain(offsetOf(MAJOR_STATE, d))
    }
  })
  it('is the all-natural scale (each degree at its natural offset)', () => {
    const naturals = [0, 2, 4, 5, 7, 9, 11]
    for (let d = 1; d <= 7; d++) {
      expect(offsetOf(MAJOR_STATE, d)).toBe(naturals[d - 1])
    }
  })
})

describe('stepMandalPosition', () => {
  const deg3 = positionsForDegree(3) // [3, 3.5, 4, 4.5]
  it('steps flatter (dir −1) down the positions list', () => {
    expect(stepMandalPosition(deg3, 4, -1)).toBe(3.5)
    expect(stepMandalPosition(deg3, 3.5, -1)).toBe(3)
  })
  it('steps sharper (dir +1) up the positions list', () => {
    expect(stepMandalPosition(deg3, 3, 1)).toBe(3.5)
    expect(stepMandalPosition(deg3, 4, 1)).toBe(4.5)
  })
  it('clamps at both ends (no wrap)', () => {
    expect(stepMandalPosition(deg3, 3, -1)).toBe(3)     // already lowest → stays
    expect(stepMandalPosition(deg3, 4.5, 1)).toBe(4.5)  // already highest → stays
  })
  it('snaps a stray offset to an end', () => {
    expect(stepMandalPosition(deg3, 99, 1)).toBe(3)     // dir +1 → lowest
    expect(stepMandalPosition(deg3, 99, -1)).toBe(4.5)  // dir −1 → highest
  })
  it('steps the tonic among its raise positions and clamps', () => {
    const deg1 = positionsForDegree(1) // [0, 0.5, 1]
    expect(stepMandalPosition(deg1, 0, 1)).toBe(0.5)   // up one
    expect(stepMandalPosition(deg1, 1, 1)).toBe(1)     // at top → stays
    expect(stepMandalPosition(deg1, 0, -1)).toBe(0)    // at bottom → stays
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
