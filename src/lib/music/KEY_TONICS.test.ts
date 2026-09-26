import { describe, expect, it } from 'vitest'
import { ACCIDENTAL_PITCH_CLASSES, KEY_TONICS } from './KEY_TONICS'
import { FLAT_NAMES } from './NOTE_NAMES'

describe('KEY_TONICS', () => {
  it('gives each pitch class one tonic, A3…A♭4', () => {
    expect(KEY_TONICS).toEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 57, 58, 59])
    KEY_TONICS.forEach((midi, pc) => expect(midi % 12).toBe(pc))
    expect(Math.min(...KEY_TONICS)).toBe(57) // A3
    expect(Math.max(...KEY_TONICS)).toBe(68) // A♭4
  })
  it('marks exactly the flat-spelled names as accidentals', () => {
    FLAT_NAMES.forEach((name, pc) => expect(ACCIDENTAL_PITCH_CLASSES.has(pc)).toBe(name.includes('♭')))
  })
})
