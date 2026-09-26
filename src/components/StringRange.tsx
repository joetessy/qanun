import { memo, useCallback } from 'react'
import type { PointerEvent } from 'react'
import type { FieldRange, RangeEndChange } from '../lib/music/types'
import { DEFAULT_FIELD_RANGE, FIELD_RANGE_MAX, FIELD_RANGE_MIN } from '../lib/music/range/FIELD_RANGE'
import { rangeFraction } from '../lib/music/range/rangeFraction'
import { stringCount } from '../lib/music/range/stringCount'
import { rangeEndForTrackPress } from '../lib/ui/rangeEndForTrackPress'

interface StringRangeProps {
  range: FieldRange
  lowLabel: string   // the bottom string's note, e.g. "G3"
  highLabel: string  // the top string's note, e.g. "D6"
  onEnd: (change: RangeEndChange) => void
  onReset: () => void
}

// The string window as one two-thumb slider over the whole compass (the fifth
// degree under the tonic to three octaves over it): drag either end, or click the
// track to pull the nearer end there. The tick marks the tonic; the count
// doubles as a reset. Two stacked native range inputs keep the keyboard and
// screen-reader behaviour of a real slider for each end.
export const StringRange = memo(({ range, lowLabel, highLabel, onEnd, onReset }: StringRangeProps) => {
  const count = stringCount(range)
  const isDefault = range.low === DEFAULT_FIELD_RANGE.low && range.high === DEFAULT_FIELD_RANGE.high
  // A press on the bare track (the thumbs are the inputs themselves, which take
  // their own presses) moves whichever end is nearer to it.
  const onTrackDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const thumb = parseFloat(getComputedStyle(e.currentTarget).getPropertyValue('--thumb')) || 0
    onEnd(rangeEndForTrackPress({ range, x: e.clientX - rect.left, width: rect.width, thumb }))
  }, [onEnd, range])
  // --lo / --hi place the lit window on the track; --tonic-f (a 0–1 fraction,
  // since CSS can't scale a length by a percentage) places the tonic tick.
  const trackStyle = {
    '--lo': `${rangeFraction(range.low) * 100}%`,
    '--hi': `${rangeFraction(range.high) * 100}%`,
    '--tonic-f': rangeFraction(0)
  }
  return (
    <div className="string-range">
      <span className="range-end">{lowLabel}</span>
      <div className="range-dual" style={trackStyle} onPointerDown={onTrackDown}>
        <input
          type="range"
          className="range-thumb"
          min={FIELD_RANGE_MIN}
          max={FIELD_RANGE_MAX}
          step={1}
          value={range.low}
          onChange={(e) => onEnd({ end: 'low', value: Number(e.target.value) })}
          aria-label="lowest string"
          aria-valuetext={lowLabel}
        />
        <input
          type="range"
          className="range-thumb"
          min={FIELD_RANGE_MIN}
          max={FIELD_RANGE_MAX}
          step={1}
          value={range.high}
          onChange={(e) => onEnd({ end: 'high', value: Number(e.target.value) })}
          aria-label="highest string"
          aria-valuetext={highLabel}
        />
      </div>
      <span className="range-end">{highLabel}</span>
      <button
        type="button"
        className="detune-readout range-count"
        onClick={onReset}
        title={isDefault ? `${count} strings (the default)` : `${count} strings — click for the default ${stringCount(DEFAULT_FIELD_RANGE)}`}
        aria-label={`${count} strings, click to reset`}
      >
        {count}
      </button>
    </div>
  )
})
