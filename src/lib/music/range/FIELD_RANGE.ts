import type { FieldRange } from '../types'
import { DEGREE_COUNT } from '../ajnas/MANDALS'
import { FIELD_REACH_ABOVE_TONIC } from '../buildField'

// The compass: from the fifth degree under the tonic (G3, yakah, at the C4
// tonic) to three octaves over it. Past the top the sampled kanun (F3–D♯6) is
// pitch-shifted too far to sound like itself.
export const FIELD_RANGE_MIN = -3
export const FIELD_RANGE_MAX = DEGREE_COUNT * 3

// G3–D6 at the C4 tonic, 19 strings: the compass floor up to one tone past the
// double octave.
export const DEFAULT_FIELD_RANGE: FieldRange = { low: FIELD_RANGE_MIN, high: FIELD_REACH_ABOVE_TONIC }

// At least a full octave plus its top tonic — every lever's string appears.
export const MIN_STRINGS = DEGREE_COUNT + 1
