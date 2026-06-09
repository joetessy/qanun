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
    // field[0] is the octave below the key (octave -1); the key is at field[7]
    expect(field[0]).toMatchObject({ degree: 1, octave: -1 })
    expect(field[6]).toMatchObject({ degree: 7, octave: -1 })
    expect(field[7]).toMatchObject({ degree: 1, octave: 0 })
    expect(field[13]).toMatchObject({ degree: 7, octave: 0 })
    expect(field[14]).toMatchObject({ degree: 1, octave: 1 })
  })

  it('places the key at field[7] (octave 0) and computes Rast-on-C midis', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    // field[0..6] is one octave below the key (C2 = MIDI 36).
    expect(field.slice(0, 7).map((c) => c.midi)).toEqual([36, 38, 39.5, 41, 43, 45, 46.5])
    // Rast on C3 (MIDI 48): C, D, E half-flat, F, G, A, B half-flat — at field[7..13].
    expect(field.slice(7, 14).map((c) => c.midi)).toEqual([48, 50, 51.5, 53, 55, 57, 58.5])
    // Next octave starts a clean 12 above the key.
    expect(field[14].midi).toBe(60)
  })

  it('derives freqHz from midi via midiToFreq', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    // field[0] is the key an octave down (C2 = MIDI 36); field[7] is the key (C3 = MIDI 48)
    expect(field[0].freqHz).toBeCloseTo(midiToFreq(36), 6)
    expect(field[7].freqHz).toBeCloseTo(midiToFreq(48), 6)
    expect(field[9].freqHz).toBeCloseTo(midiToFreq(51.5), 6) // degree 3, octave 0 — quarter-tone
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
    // field[0..6] is octave -1; field[7..13] is octave 0; field[14..20] is octave 1
    expect(field[9].midi).toBe(51)   // degree 3, octave 0 (field[7+2])
    expect(field[16].midi).toBe(63)  // degree 3, octave 1 (field[14+2]) — also moved
  })

  it('includes an octave below the key for leading tones', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    expect(field[0].midi).toBe(36)      // C2 — the key (C3=48) an octave down
    expect(field[0].octave).toBe(-1)
    expect(field.find((c) => c.midi === 48)).toBeTruthy() // the key is still present
    expect(field).toHaveLength(7 * FIELD_OCTAVES)
  })
})
