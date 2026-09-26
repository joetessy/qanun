import type { FieldRange, RangeEndChange } from '../types'
import { FIELD_RANGE_MAX, FIELD_RANGE_MIN, MIN_STRINGS } from './FIELD_RANGE'
import { clamp } from '../../math/clamp'

interface SetRangeEndArgs extends RangeEndChange {
  range: FieldRange
}

// Move one end of the window to a slider value (rounded to a whole string). It
// stays inside the compass and stops MIN_STRINGS short of the other end — the
// moving end never pushes the other one along.
export const setRangeEnd = ({ range, end, value }: SetRangeEndArgs): FieldRange => {
  const v = Math.round(value)
  return end === 'low'
    ? { ...range, low: clamp(v, FIELD_RANGE_MIN, range.high - (MIN_STRINGS - 1)) }
    : { ...range, high: clamp(v, range.low + (MIN_STRINGS - 1), FIELD_RANGE_MAX) }
}
