import { describe, expect, it } from 'vitest'
import { DEFAULT_FIELD_RANGE, FIELD_RANGE_MAX, FIELD_RANGE_MIN, MIN_STRINGS } from './FIELD_RANGE'
import { fieldWindow } from './fieldWindow'
import { stringCount } from './stringCount'
import { buildField, DEFAULT_TONIC_MIDI } from '../buildField'
import { NATURAL_STATE } from '../ajnas/MANDALS'

describe('FIELD_RANGE', () => {
  it('defaults to the 19-string G3–D6 window at the C4 tonic', () => {
    expect(DEFAULT_FIELD_RANGE).toEqual({ low: -3, high: 15 })
    const field = buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: NATURAL_STATE, ...fieldWindow(DEFAULT_FIELD_RANGE) })
    expect(field).toHaveLength(19)
    expect(field[0].midi).toBe(55)                // G3
    expect(field[field.length - 1].midi).toBe(86) // D6
  })
  it('spans the fifth degree under the tonic to three octaves over it, at least an octave wide', () => {
    expect(FIELD_RANGE_MIN).toBe(-3)
    expect(FIELD_RANGE_MAX).toBe(21)
    expect(MIN_STRINGS).toBe(8)
    expect(stringCount({ low: FIELD_RANGE_MIN, high: FIELD_RANGE_MAX })).toBe(25)
  })
})
