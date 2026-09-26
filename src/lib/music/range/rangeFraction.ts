import { FIELD_RANGE_MAX, FIELD_RANGE_MIN } from './FIELD_RANGE'

// Where a step (strings from the tonic) sits along the whole compass, 0 at the
// bottom to 1 at the top — the string-range slider's track position.
export const rangeFraction = (steps: number): number =>
  (steps - FIELD_RANGE_MIN) / (FIELD_RANGE_MAX - FIELD_RANGE_MIN)
