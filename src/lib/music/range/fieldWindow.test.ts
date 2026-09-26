import { describe, expect, it } from 'vitest'
import { fieldWindow } from './fieldWindow'
import { stringCount } from './stringCount'
import { FIELD_RANGE_MAX, FIELD_RANGE_MIN, MIN_STRINGS } from './FIELD_RANGE'
import { buildField } from '../buildField'
import { DEFAULT_RAST_STATE, NATURAL_STATE } from '../ajnas/MANDALS'

describe('fieldWindow → buildField', () => {
  it('maps a range to strings kept below / above the tonic', () => {
    expect(fieldWindow({ low: -9, high: 15 })).toEqual({ leadingTones: 9, reachAboveTonic: 15 })
  })
  it('builds a window that starts above the tonic', () => {
    const above = { low: 3, high: 17 }
    const field = buildField({ tonicMidi: 60, mandalState: DEFAULT_RAST_STATE, ...fieldWindow(above) })
    expect(field).toHaveLength(stringCount(above))
    expect(field[0]).toMatchObject({ degree: 4, octave: 0, midi: 65 })  // F4 — the tonic is left out
    expect(field[field.length - 1]).toMatchObject({ degree: 4, octave: 2, midi: 89 }) // F6
    field.forEach((c, i) => expect(c.index).toBe(i))
  })
  it('builds a window that ends below the tonic', () => {
    const below = { low: -14, high: -7 }
    const field = buildField({ tonicMidi: 60, mandalState: NATURAL_STATE, ...fieldWindow(below) })
    expect(field).toHaveLength(stringCount(below))
    expect(field[0].midi).toBe(36)                // C2
    expect(field[field.length - 1].midi).toBe(48) // C3 — an octave under the tonic
  })
  it('keeps every window’s strings contiguous and in order across the compass', () => {
    for (let low = FIELD_RANGE_MIN; low <= FIELD_RANGE_MAX - (MIN_STRINGS - 1); low += 3) {
      for (let high = low + MIN_STRINGS - 1; high <= FIELD_RANGE_MAX; high += 4) {
        const field = buildField({ tonicMidi: 57, mandalState: DEFAULT_RAST_STATE, ...fieldWindow({ low, high }) })
        expect(field).toHaveLength(high - low + 1)
        for (let i = 1; i < field.length; i++) expect(field[i].midi).toBeGreaterThan(field[i - 1].midi)
      }
    }
  })
  it('reaches the full compass', () => {
    const full = { low: FIELD_RANGE_MIN, high: FIELD_RANGE_MAX }
    const field = buildField({ tonicMidi: 60, mandalState: NATURAL_STATE, ...fieldWindow(full) })
    expect(field).toHaveLength(stringCount(full))
    expect(field[0].midi).toBe(55)                // G3
    expect(field[field.length - 1].midi).toBe(96) // C7
  })
})
