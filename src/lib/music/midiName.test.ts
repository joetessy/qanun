import { describe, expect, it } from 'vitest'
import { midiName } from './midiName'

describe('midiName', () => {
  it('prints integer MIDI as note + octave', () => {
    expect(midiName(60)).toBe('C4')
    expect(midiName(69)).toBe('A4')
  })

  it('spells accidentals with flats (Arabic convention)', () => {
    expect(midiName(61)).toBe('D♭4')
  })

  it('rounds a quarter-tone tie up to the neighbouring natural with U+2212 minus', () => {
    expect(midiName(63.5)).toBe('E4 −50¢')
  })

  it('rounds just below the tie down to the flat with a plus sign', () => {
    expect(midiName(63.49)).toBe('E♭4 +49¢')
  })

  it('crosses the octave boundary when the tie rounds up', () => {
    expect(midiName(59.5)).toBe('C4 −50¢')
  })
})
