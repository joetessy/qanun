import { describe, expect, it } from 'vitest'
import { courseNoteName } from './courseNoteName'
import { buildField } from './buildField'
import { DEFAULT_RAST_STATE, NATURAL_STATE } from './ajnas/MANDALS'

describe('courseNoteName', () => {
  it('names the default field ends A2 and D6 (C4 tonic)', () => {
    const field = buildField({ tonicMidi: 60, mandalState: NATURAL_STATE, leadingTones: 9, reachAboveTonic: 15 })
    expect(courseNoteName({ course: field[0], tonicMidi: 60 })).toBe('A2')
    expect(courseNoteName({ course: field[field.length - 1], tonicMidi: 60 })).toBe('D6')
  })
  it('spells a quarter-tone string by its lever, not by cents', () => {
    const field = buildField({ tonicMidi: 60, mandalState: DEFAULT_RAST_STATE })
    const b = field.find((c) => c.degree === 7 && c.octave === 1)!
    expect(courseNoteName({ course: b, tonicMidi: 60 })).toBe('B½♭5')
  })
  it('keeps the letter’s octave for a lever that crosses C (B♯4 sounds as C5)', () => {
    const field = buildField({ tonicMidi: 60, mandalState: [0, 2, 4, 5, 7, 9, 12] })
    const b = field.find((c) => c.degree === 7 && c.octave === 0)!
    expect(b.midi).toBe(72)
    expect(courseNoteName({ course: b, tonicMidi: 60 })).toBe('B♯4')
  })
  it('spells a flat key with flats (D♭ tonic)', () => {
    const field = buildField({ tonicMidi: 61, mandalState: NATURAL_STATE })
    const tonic = field.find((c) => c.degree === 1 && c.octave === 0)!
    expect(courseNoteName({ course: tonic, tonicMidi: 61 })).toBe('D♭4')
  })
})
