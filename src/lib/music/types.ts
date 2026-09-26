// The pure music model. Pitch convention: semitones from a reference, with
// quarter-tones as half-integers (half-flat = .5). See docs/MUSIC-THEORY.md §2.

// A jins: a 3–5 note melodic cell with one tonicized note.
export interface Jins {
  id: string
  label: string
  // Semitone offsets from the jins tonic; intervals[0] is always 0.
  intervals: readonly number[]
  // Scale degree (1-indexed, within the jins) of the ghammāz — the top note /
  // where the next jins begins. 3 = trichord, 4 = tetrachord, 5 = pentachord.
  ghammazDegree: number
  // The scale degree of the field on which this jins idiomatically roots.
  // 1 for most; 3 for the half-flat-tonic trichords (Sikah). Default 1.
  homeDegree: number
  // Only ever a lower jins — it starts a maqam but is never offered as the
  // upper jins on another's ghammāz (Sikah). Absent = usable in both roles.
  lowerOnly?: boolean
}

// Live mandal tuning: one chosen semitone offset (from the tonic) per scale
// degree. Index d-1 holds the offset for degree d. Length DEGREE_COUNT (7).
export type MandalState = readonly number[]

// One playable string on the field.
export interface Course {
  index: number   // 0-based position in the field, low → high
  degree: number  // 1..7 (scale degree)
  octave: number  // 0-based octave index within the field
  midi: number    // tonicMidi + 12*octave + offset(degree)
  freqHz: number
}

// A lower jins with an upper jins on its ghammāz, by jins id.
export interface JinsPair {
  lowerId: string
  upperId: string
}

// What the current mandal state spells out.
export interface AjnasIdentity {
  lower: string | null   // jins id of the lower (root) jins
  upper: string | null   // jins id of the upper jins (from the ghammāz)
  maqamName: string      // friendly maqam name, "Lower ▸ Upper", or "custom"
}

// The playable string window, in strings (scale steps) from the tonic: `low` is
// the bottom string, `high` the top; 0 is the tonic, negative is below it. The
// window moves with the tonic, so a key change keeps the same shape of field.
export interface FieldRange {
  low: number
  high: number
}

// One end of the string window.
export type RangeEnd = 'low' | 'high'

// A request to move one end of the window to a new step (the slider's value).
export interface RangeEndChange {
  end: RangeEnd
  value: number
}
