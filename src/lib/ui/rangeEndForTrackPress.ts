import type { FieldRange, RangeEndChange } from '../music/types'
import { FIELD_RANGE_MAX, FIELD_RANGE_MIN } from '../music/range/FIELD_RANGE'
import { clamp } from '../math/clamp'

interface RangeEndForTrackPressArgs {
  range: FieldRange
  x: number     // pointer x from the track element's left edge
  width: number // the track element's width
  thumb: number // thumb diameter — the track runs inset by half a thumb each side
}

// A press on the bare track of the two-thumb string-range slider: the step under
// the pointer, and whichever end is nearer to it — the one that moves there. The
// drawn track is inset by half a thumb (as far as a native thumb's centre can
// travel), so the position is measured along that span.
export const rangeEndForTrackPress = ({ range, x, width, thumb }: RangeEndForTrackPressArgs): RangeEndChange => {
  const along = clamp((x - thumb / 2) / Math.max(1, width - thumb), 0, 1)
  const value = FIELD_RANGE_MIN + along * (FIELD_RANGE_MAX - FIELD_RANGE_MIN)
  return { end: Math.abs(value - range.low) <= Math.abs(value - range.high) ? 'low' : 'high', value }
}
