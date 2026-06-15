// Render a (possibly fractional) MIDI note. Integer MIDI prints as "A4";
// quarter-tones print with a cents annotation, e.g. "E♭4 +50¢" — the value
// Arabic maqamat conventionally call "E half-flat" / "sika". Accidentals spell as
// FLATS (Arabic notation favours them) — this is the absolute readout used by the
// last-note display and the tonic/key control. The relative lever labels keep
// NOTE_NAMES (sharps read naturally for a raised lever).
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

export const midiName = (midi: number): string => {
  const rounded = Math.round(midi)
  const cents = Math.round((midi - rounded) * 100)
  const name = FLAT_NAMES[((rounded % 12) + 12) % 12]
  const octave = Math.floor(rounded / 12) - 1
  if (cents === 0) return `${name}${octave}`
  const sign = cents > 0 ? '+' : '−'
  return `${name}${octave} ${sign}${Math.abs(cents)}¢`
}
