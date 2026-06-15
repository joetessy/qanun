import { describe, expect, it } from 'vitest'
import { degreeNoteLabel } from './degreeLabel'

// C tonic = MIDI 48 (C3). NOTE_NAMES[0] = 'C'.
// NATURAL_OFFSETS = [0, 2, 4, 5, 7, 9, 11] (major scale degrees 1-7)
const C = 48

describe('degreeNoteLabel — C tonic (MIDI 48)', () => {
  it('deg1 off0 → "C"  (natural, no glyph)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 1, offset: 0 })).toBe('C')
  })

  it('deg3 off3.5 → "E½♭"  (half-flat 3rd)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 3, offset: 3.5 })).toBe('E½♭')
  })

  it('deg3 off4 → "E"  (natural 3rd)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 3, offset: 4 })).toBe('E')
  })

  it('deg3 off3 → "E♭"  (flat 3rd)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 3, offset: 3 })).toBe('E♭')
  })

  it('deg7 off10.5 → "B½♭"  (half-flat 7th)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 7, offset: 10.5 })).toBe('B½♭')
  })

  it('deg7 off11 → "B"  (natural 7th)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 7, offset: 11 })).toBe('B')
  })

  it('deg7 off10 → "B♭"  (flat 7th)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 7, offset: 10 })).toBe('B♭')
  })

  it('deg4 off6 → "F♯"  (sharp 4th / aug 4th)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 4, offset: 6 })).toBe('F♯')
  })

  it('deg4 off5 → "F"  (natural 4th)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 4, offset: 5 })).toBe('F')
  })

  // deg2 base = NOTE_NAMES[(0+2)%12] = 'D'; natural offset=2; off1 → delta=-1 → "D♭"
  it('deg2 off1 → "D♭"  (flat 2nd)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 2, offset: 1 })).toBe('D♭')
  })

  // deg2 off1.5 → base D, delta=1.5-2=-0.5 → "D½♭"
  it('deg2 off1.5 → "D½♭"  (half-flat 2nd / bayati 2nd)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 2, offset: 1.5 })).toBe('D½♭')
  })

  // deg2 off2 → base D, delta=0 → "D"
  it('deg2 off2 → "D"  (natural 2nd)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 2, offset: 2 })).toBe('D')
  })

  // deg6 natural offset=9, NOTE_NAMES[(0+9)%12]='A'; off8 → delta=-1 → "A♭"
  it('deg6 off8 → "A♭"', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 6, offset: 8 })).toBe('A♭')
  })

  // deg5 is fixed, offset=7, NOTE_NAMES[(0+7)%12]='G'; delta=0 → "G"
  it('deg5 off7 → "G"  (natural 5th)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 5, offset: 7 })).toBe('G')
  })

  // deg1 is fixed, offset=0; delta=0 → "C"
  it('deg1 off0 → "C"  (tonic, fixed)', () => {
    expect(degreeNoteLabel({ tonicMidi: C, degree: 1, offset: 0 })).toBe('C')
  })
})

describe('degreeNoteLabel — flats option (absolute readouts)', () => {
  // A♭ tonic = MIDI 68. Default spells the base with a sharp; flats:true spells
  // it as a flat — the spelling the jins "home" readout and tonic control use.
  it('A♭ tonic deg1 → "G#" by default but "A♭" with flats:true', () => {
    expect(degreeNoteLabel({ tonicMidi: 68, degree: 1, offset: 0 })).toBe('G#')
    expect(degreeNoteLabel({ tonicMidi: 68, degree: 1, offset: 0, flats: true })).toBe('A♭')
  })

  // E♭ tonic = MIDI 63 → pitch class 3.
  it('E♭ tonic deg1 → "D#" by default but "E♭" with flats:true', () => {
    expect(degreeNoteLabel({ tonicMidi: 63, degree: 1, offset: 0 })).toBe('D#')
    expect(degreeNoteLabel({ tonicMidi: 63, degree: 1, offset: 0, flats: true })).toBe('E♭')
  })

  // Naturals are unaffected by the flag.
  it('C tonic deg1 → "C" regardless of flats', () => {
    expect(degreeNoteLabel({ tonicMidi: 60, degree: 1, offset: 0, flats: true })).toBe('C')
  })
})

describe('degreeNoteLabel — D tonic (MIDI 50)', () => {
  // D tonic: NOTE_NAMES[2]='D'. For degree 3: natural offset=4 → NOTE_NAMES[(2+4)%12]=NOTE_NAMES[6]='F#'
  // off 3.5 → delta = 3.5 - 4 = -0.5 → 'F#½♭'
  it('deg3 off3.5 → "F#½♭"  (half-flat 3rd over D)', () => {
    expect(degreeNoteLabel({ tonicMidi: 50, degree: 3, offset: 3.5 })).toBe('F#½♭')
  })

  // deg3 off4 → 'F#' natural
  it('deg3 off4 → "F#"  (natural 3rd over D)', () => {
    expect(degreeNoteLabel({ tonicMidi: 50, degree: 3, offset: 4 })).toBe('F#')
  })

  // deg2: natural offset=2 → NOTE_NAMES[(2+2)%12]=NOTE_NAMES[4]='E'; off2 → 'E'
  it('deg2 off2 → "E"  (natural 2nd over D)', () => {
    expect(degreeNoteLabel({ tonicMidi: 50, degree: 2, offset: 2 })).toBe('E')
  })

  // deg7: natural offset=11 → NOTE_NAMES[(2+11)%12]=NOTE_NAMES[13%12]=NOTE_NAMES[1]='C#'
  // off10.5 → delta = 10.5-11 = -0.5 → 'C#½♭'
  it('deg7 off10.5 → "C#½♭"  (half-flat 7th over D)', () => {
    expect(degreeNoteLabel({ tonicMidi: 50, degree: 7, offset: 10.5 })).toBe('C#½♭')
  })
})
