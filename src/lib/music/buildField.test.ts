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

  // ── detune (cents offset / fine tune) ──────────────────────────────────────
  // A global cents offset shifts the SOUNDING pitch of every course up or down by
  // up to a semitone, while leaving each course's `midi` (and therefore its note
  // name / degree label) untouched. It is purely a frequency ratio.
  it('defaults to no detune (omitted detuneCents === detuneCents 0)', () => {
    const base = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    const zero = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, detuneCents: 0 })
    base.forEach((c, i) => expect(zero[i].freqHz).toBeCloseTo(c.freqHz, 9))
  })

  it('+100 cents sounds every course a semitone up but leaves midi labels unchanged', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, detuneCents: 100 })
    expect(field[7].midi).toBe(48)                            // label/midi untouched
    expect(field[7].freqHz).toBeCloseTo(midiToFreq(49), 6)    // …but sounds a semitone up
    expect(field[9].midi).toBe(51.5)                          // quarter-tone label untouched
    expect(field[9].freqHz).toBeCloseTo(midiToFreq(52.5), 6)  // …and its pitch follows
  })

  it('-100 cents sounds every course a semitone down', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, detuneCents: -100 })
    expect(field[7].midi).toBe(48)
    expect(field[7].freqHz).toBeCloseTo(midiToFreq(47), 6)
  })

  it('applies a partial offset as a frequency ratio (2^(cents/1200))', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, detuneCents: 37 })
    expect(field[7].freqHz).toBeCloseTo(midiToFreq(48) * Math.pow(2, 37 / 1200), 6)
  })

  // ── windowed field (leadingTones below + reachAboveTonic above the tonic) ─────
  it('keeps the full grid when the window params are omitted', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    expect(field).toHaveLength(7 * FIELD_OCTAVES)
  })

  it('keeps only N leading tones below the tonic and reindexes 0..n-1', () => {
    // Full grid has a whole octave (7) below the tonic; keeping 2 drops the lowest 5.
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, leadingTones: 2 })
    expect(field).toHaveLength(7 * FIELD_OCTAVES - 5)
    field.forEach((c, i) => expect(c.index).toBe(i))
    // Lowest string is now degree 6, octave -1 (A2 = MIDI 45) — a leading tone.
    expect(field[0]).toMatchObject({ degree: 6, octave: -1, midi: 45, index: 0 })
    // The tonic (C3 = 48) now sits two strings up.
    expect(field[2]).toMatchObject({ degree: 1, octave: 0, midi: 48 })
  })

  it('trims the top to a given reach above the tonic', () => {
    // 2 leading tones + tonic + 15 steps up (3 tonics across 2 octaves, +1 tone) = 18.
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, leadingTones: 2, reachAboveTonic: 15 })
    expect(field).toHaveLength(18)
    expect(field[0]).toMatchObject({ degree: 6, octave: -1, midi: 45 })   // A2 (bottom)
    expect(field[2]).toMatchObject({ degree: 1, octave: 0, midi: 48 })    // C3 (tonic)
    // Top = 15 steps above the tonic = degree 2, octave 2 (D5 = MIDI 74).
    expect(field[field.length - 1]).toMatchObject({ degree: 2, octave: 2, midi: 74 })
  })

  it('preserves detune within the window', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE, leadingTones: 2, reachAboveTonic: 15, detuneCents: 100 })
    expect(field[2].midi).toBe(48)                          // tonic label untouched
    expect(field[2].freqHz).toBeCloseTo(midiToFreq(49), 6)  // …sounds a semitone up
  })
})
