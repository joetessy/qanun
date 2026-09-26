import { describe, expect, it } from 'vitest'
import { setRangeEnd } from './setRangeEnd'
import { stringCount } from './stringCount'
import { DEFAULT_FIELD_RANGE, FIELD_RANGE_MAX, FIELD_RANGE_MIN, MIN_STRINGS } from './FIELD_RANGE'

const range = DEFAULT_FIELD_RANGE // { low: -3, high: 15 }

describe('setRangeEnd', () => {
  it('moves one end and leaves the other alone', () => {
    expect(setRangeEnd({ range, end: 'low', value: -1 })).toEqual({ low: -1, high: 15 })
    expect(setRangeEnd({ range, end: 'high', value: 21 })).toEqual({ low: -3, high: 21 })
  })
  it('keeps the window inside the compass', () => {
    expect(setRangeEnd({ range, end: 'low', value: -99 }).low).toBe(FIELD_RANGE_MIN)
    expect(setRangeEnd({ range, end: 'high', value: 99 }).high).toBe(FIELD_RANGE_MAX)
  })
  it('stops MIN_STRINGS short of the other end instead of pushing it', () => {
    const squeezedUp = setRangeEnd({ range, end: 'low', value: 40 })
    expect(squeezedUp).toEqual({ low: 15 - (MIN_STRINGS - 1), high: 15 })
    expect(stringCount(squeezedUp)).toBe(MIN_STRINGS)
    expect(setRangeEnd({ range, end: 'high', value: -40 })).toEqual({ low: -3, high: -3 + MIN_STRINGS - 1 })
  })
  it('rounds slider values to whole strings', () => {
    expect(setRangeEnd({ range, end: 'high', value: 12.6 }).high).toBe(13)
  })
})
