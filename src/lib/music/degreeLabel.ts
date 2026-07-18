import { NOTE_NAMES, FLAT_NAMES } from './NOTE_NAMES'

// The semitone offset of each scale degree in a major (natural) scale.
// Index 0 = degree 1, index 6 = degree 7.
export const NATURAL_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const

// Map a delta (offset − natural offset) to its accidental glyph.
const glyphFor = (delta: number): string => {
  if (delta === 0)    return ''
  if (delta === -0.5) return '½♭'
  if (delta === -1)   return '♭'
  if (delta === 1)    return '♯'
  if (delta === 0.5)  return '½♯'
  return delta > 0 ? `+${delta}` : `${delta}`
}

export interface DegreeLabelArgs {
  tonicMidi: number
  degree: number      // 1..7
  offset: number      // semitones from tonic (may be half-integer)
  // Spell the base pitch class with flats (Arabic convention) instead of the
  // default sharps. Use for absolute readouts; leave off for relative levers.
  flats?: boolean
}

/**
 * Returns the note label for a mandal degree in the context of a given tonic.
 * Example: C tonic, degree 3, offset 3.5 → "E½♭"
 */
export const degreeNoteLabel = ({ tonicMidi, degree, offset, flats = false }: DegreeLabelArgs): string => {
  const naturalOffset = NATURAL_OFFSETS[degree - 1]
  const tonicPc = tonicMidi % 12
  const basePc = (tonicPc + naturalOffset) % 12
  const base = (flats ? FLAT_NAMES : NOTE_NAMES)[basePc]
  const delta = offset - naturalOffset
  return base + glyphFor(delta)
}
