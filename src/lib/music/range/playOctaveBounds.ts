import type { FieldRange } from '../types'
import { DEGREE_COUNT } from '../ajnas/MANDALS'
import { stringCount } from './stringCount'

interface PlayOctaveBoundsArgs {
  range: FieldRange
  keyCount: number // how many play keys run up from the tonic (A–L and on)
}

export interface OctaveBounds {
  min: number
  max: number
}

// The computer-keyboard play layer runs the scale up from the tonic, one key
// per string, an octave at a time (Z / X shift it). These are the octaves that
// put at least one key on a string, counted from the tonic's own octave (0):
// the lowest still reaches the bottom string with its top keys (its first keys
// fall silent below the window), the highest starts on a string. Between them
// every string in the window is playable.
export const playOctaveBounds = ({ range, keyCount }: PlayOctaveBoundsArgs): OctaveBounds => {
  const tonicIndex = -range.low
  return {
    // `+ 0` folds Math.ceil's −0 into 0.
    min: Math.ceil((-tonicIndex - (keyCount - 1)) / DEGREE_COUNT) + 0,
    max: Math.floor((stringCount(range) - 1 - tonicIndex) / DEGREE_COUNT)
  }
}
