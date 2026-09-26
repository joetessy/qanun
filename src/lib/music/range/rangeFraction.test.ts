import { describe, expect, it } from 'vitest'
import { rangeFraction } from './rangeFraction'
import { FIELD_RANGE_MAX, FIELD_RANGE_MIN } from './FIELD_RANGE'

describe('rangeFraction', () => {
  it('maps the compass onto 0…1', () => {
    expect(rangeFraction(FIELD_RANGE_MIN)).toBe(0)
    expect(rangeFraction(FIELD_RANGE_MAX)).toBe(1)
    expect(rangeFraction(0)).toBeCloseTo(0.125) // the tonic sits an eighth along
  })
})
