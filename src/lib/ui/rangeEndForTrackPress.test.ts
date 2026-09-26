import { describe, expect, it } from 'vitest'
import { rangeEndForTrackPress } from './rangeEndForTrackPress'
import { FIELD_RANGE_MAX, FIELD_RANGE_MIN } from '../music/range/FIELD_RANGE'

const range = { low: -3, high: 15 }
// A 154px track + 14px thumb: the thumb centres travel 7…161, 154 / 24 ≈ 6.4px per step.
const track = { width: 168, thumb: 14 }

describe('rangeEndForTrackPress', () => {
  it('maps the inset track onto the compass', () => {
    expect(rangeEndForTrackPress({ range, x: 7, ...track }).value).toBeCloseTo(FIELD_RANGE_MIN)
    expect(rangeEndForTrackPress({ range, x: 161, ...track }).value).toBeCloseTo(FIELD_RANGE_MAX)
    expect(rangeEndForTrackPress({ range, x: 7 + 154 * (3 / 24), ...track }).value).toBeCloseTo(0) // the tonic
  })
  it('clamps presses beyond the thumb travel to the compass ends', () => {
    expect(rangeEndForTrackPress({ range, x: 0, ...track }).value).toBe(FIELD_RANGE_MIN)
    expect(rangeEndForTrackPress({ range, x: 168, ...track }).value).toBe(FIELD_RANGE_MAX)
  })
  it('moves whichever end is nearer', () => {
    expect(rangeEndForTrackPress({ range, x: 7, ...track }).end).toBe('low')
    expect(rangeEndForTrackPress({ range, x: 161, ...track }).end).toBe('high')
    // Step 5 is 8 from low (−3) but 10 from high (15).
    expect(rangeEndForTrackPress({ range, x: 7 + 154 * (8 / 24), ...track }).end).toBe('low')
    // Step 7 is 10 from low but 8 from high.
    expect(rangeEndForTrackPress({ range, x: 7 + 154 * (10 / 24), ...track }).end).toBe('high')
  })
})
