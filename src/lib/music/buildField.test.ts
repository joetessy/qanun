import { describe, expect, it } from 'vitest'
import { buildField, DEFAULT_TONIC_MIDI, FIELD_OCTAVES } from './buildField'
import { DEFAULT_RAST_STATE, setMandal } from './ajnas/MANDALS'
import { midiToFreq } from './midiToFreq'

describe('buildField', () => {
  it('produces 7 courses per octave across FIELD_OCTAVES', () => {
    const field = buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
    expect(field).toHaveLength(7 * FIELD_OCTAVES)
    expect(FIELD_OCTAVES).toBe(4)
  })

  it('indexes courses 0..n-1 in order with correct degree/octave labels', () => {
    const field = buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
    field.forEach((c, i) => expect(c.index).toBe(i))
    expect(field[0]).toMatchObject({ degree: 1, octave: 0 })
    expect(field[6]).toMatchObject({ degree: 7, octave: 0 })
    expect(field[7]).toMatchObject({ degree: 1, octave: 1 })
  })

  it('places the first course at the tonic and computes Rast-on-C midis', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    // Rast on C3 (MIDI 48): C, D, E half-flat, F, G, A, B half-flat.
    expect(field.slice(0, 7).map((c) => c.midi)).toEqual([48, 50, 51.5, 53, 55, 57, 58.5])
    // Next octave starts a clean 12 above.
    expect(field[7].midi).toBe(60)
  })

  it('derives freqHz from midi via midiToFreq', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    expect(field[0].freqHz).toBeCloseTo(midiToFreq(48), 6)
    expect(field[2].freqHz).toBeCloseTo(midiToFreq(51.5), 6) // quarter-tone
  })

  it('is non-decreasing in midi for ANY mandal state (string order = degree order)', () => {
    // Extreme state: degree 3 natural (4) and degree 4 dim (4) collide in pitch.
    let state = setMandal(DEFAULT_RAST_STATE, 3, 4)
    state = setMandal(state, 4, 4)
    const field = buildField({ tonicMidi: 48, mandalState: state })
    for (let i = 1; i < field.length; i++) {
      expect(field[i].midi).toBeGreaterThanOrEqual(field[i - 1].midi)
    }
  })

  it('retunes the whole field when a mandal changes (every octave follows)', () => {
    const lowered = setMandal(DEFAULT_RAST_STATE, 3, 3) // E half-flat → E flat
    const field = buildField({ tonicMidi: 48, mandalState: lowered })
    expect(field[2].midi).toBe(51)   // degree 3, octave 0
    expect(field[9].midi).toBe(63)   // degree 3, octave 1 — also moved
  })
})
