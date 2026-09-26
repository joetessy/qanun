import { describe, expect, it } from 'vitest'
import { isNaturalState } from './isNaturalState'
import { DEFAULT_RAST_STATE, NATURAL_STATE, setMandal } from './MANDALS'

describe('isNaturalState', () => {
  it('is true only while every lever is down', () => {
    expect(isNaturalState(NATURAL_STATE)).toBe(true)
    expect(isNaturalState([0, 2, 4, 5, 7, 9, 11])).toBe(true)
    expect(isNaturalState(DEFAULT_RAST_STATE)).toBe(false)
    expect(isNaturalState(setMandal(NATURAL_STATE, 1, 0.5))).toBe(false)
  })
})
