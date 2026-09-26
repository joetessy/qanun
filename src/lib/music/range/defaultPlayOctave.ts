import type { FieldRange } from '../types'
import { DEGREE_COUNT } from '../ajnas/MANDALS'
import { playOctaveBounds } from './playOctaveBounds'
import { stringCount } from './stringCount'

interface DefaultPlayOctaveArgs {
  range: FieldRange
  keyCount: number
}

// The octave the play keys start in for a window: the one whose keys cover the
// most strings, nearest the tonic's own octave on a tie — so 'a' is the tonic
// whenever the window holds a full run of keys from it, and a window far above
// or below the tonic still starts with every key it can on a string.
export const defaultPlayOctave = ({ range, keyCount }: DefaultPlayOctaveArgs): number => {
  const { min, max } = playOctaveBounds({ range, keyCount })
  const last = stringCount(range) - 1
  let best = min
  let bestCover = -1
  for (let octave = min; octave <= max; octave++) {
    const first = -range.low + octave * DEGREE_COUNT
    const cover = Math.min(last, first + keyCount - 1) - Math.max(0, first) + 1
    if (cover > bestCover || (cover === bestCover && Math.abs(octave) < Math.abs(best))) {
      best = octave
      bestCover = cover
    }
  }
  return best
}
