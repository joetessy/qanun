export const NOTE_NAMES: readonly string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
]

// Flat spelling of the 12 pitch classes — Arabic notation favours flats. Used
// for ABSOLUTE readouts (last-note display, tonic/key control, the jins "home"
// note) so they all agree. The relative lever labels keep NOTE_NAMES, where a
// sharp reads naturally for a raised lever.
export const FLAT_NAMES: readonly string[] = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B'
]
