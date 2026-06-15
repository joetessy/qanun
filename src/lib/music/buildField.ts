import type { Course, MandalState } from './types'
import { DEGREE_COUNT, offsetOf } from './ajnas/MANDALS'
import { midiToFreq } from './midiToFreq'

// Anchor the field low enough to span the qanun's working range. C4 = MIDI 60;
// the raw grid is built in whole octaves, then trimmed to the playable window
// (see leadingTones / reachAboveTonic) around the tonic.
export const DEFAULT_TONIC_MIDI = 60
export const FIELD_OCTAVES = 4
export const FIELD_OCTAVES_BELOW = 1

// The playable window, in scale steps from the tonic. A full octave plus two
// leading tones below the tonic (9 steps, bottoming two strings below the
// octave-down tonic — two below C3 at the default tonic); above it, two full
// octaves (2 × 7 = 14 steps) plus one more tone, ending on D6 at the default
// tonic. Together: 9 + 1 (tonic) + 15 = 25 strings — wide spacing for precise
// hand-tracking selection. The tonic still sits at index FIELD_LEADING_TONES, so
// the computer-keyboard play layer ('a' = tonic = C4) is unaffected. buildField
// grows its raw grid to cover whatever reach is requested, so these constants
// can't be silently clamped.
export const FIELD_LEADING_TONES = 9
export const FIELD_REACH_ABOVE_TONIC = DEGREE_COUNT * 2 + 1
// A fine-tune offset may reach at most one semitone (100 cents) either way — far
// enough to retune all the way to an adjacent pitch. Shared by the engine clamp
// and the TUNE-menu slider so the two can't drift apart.
export const DETUNE_LIMIT_CENTS = 100

export interface BuildFieldArgs {
  tonicMidi: number
  mandalState: MandalState
  octaveCount?: number
  octavesBelow?: number
  // Global fine-tune in cents (−100…+100). Shifts every course's SOUNDING pitch
  // by this many cents while leaving its `midi` (note name / degree label)
  // untouched — a master-tuning offset, not a transposition. cents/100 semitones
  // fed back through midiToFreq is exactly a 2^(cents/1200) frequency ratio.
  detuneCents?: number
  // Trim the built grid to a playable window around the tonic, measured in scale
  // steps. Omit a side to keep the whole grid on that side (default = full,
  // backward-compatible). Narrows the field without changing the octave model.
  leadingTones?: number    // scale steps to KEEP below the tonic
  reachAboveTonic?: number // scale steps to KEEP above the tonic
}

// Lay out the scale-locked string field: for each octave, one course per scale
// degree, ordered by (octave, degree) — the physical string order on a qanun.
// A glide across this array runs the current maqam by construction.
// The field starts octavesBelow octaves below the tonic (for leading tones); an
// un-windowed call always yields 7 * octaveCount courses.
export const buildField = ({
  tonicMidi,
  mandalState,
  octaveCount = FIELD_OCTAVES,
  octavesBelow = FIELD_OCTAVES_BELOW,
  detuneCents = 0,
  leadingTones,
  reachAboveTonic
}: BuildFieldArgs): Course[] => {
  // Grow the raw grid to fit the requested window — otherwise a reach beyond the
  // default grid would be silently clamped (wrong edge string). Both sides grow:
  // leadingTones may dip more than one octave below the tonic, reachAboveTonic
  // more than three above. The tonic stays at octavesBelow * DEGREE_COUNT, so the
  // play-layer index (which keys off FIELD_LEADING_TONES) is unaffected.
  const octavesBelowFit = leadingTones == null
    ? octavesBelow
    : Math.max(octavesBelow, Math.ceil(leadingTones / DEGREE_COUNT))
  const gridOctaves = reachAboveTonic == null
    ? octaveCount
    : Math.max(octaveCount, octavesBelowFit + Math.ceil((reachAboveTonic + 1) / DEGREE_COUNT))
  const courses: Course[] = []
  let index = 0
  const detuneSemitones = detuneCents / 100
  for (let octave = -octavesBelowFit; octave < gridOctaves - octavesBelowFit; octave++) {
    for (let degree = 1; degree <= DEGREE_COUNT; degree++) {
      const midi = tonicMidi + 12 * octave + offsetOf(mandalState, degree)
      // Detune touches only the frequency, never the stored `midi` label.
      courses.push({ index, degree, octave, midi, freqHz: midiToFreq(midi + detuneSemitones) })
      index++
    }
  }
  // The tonic (degree 1, octave 0) lands here in the freshly built grid.
  const tonicIndex = octavesBelowFit * DEGREE_COUNT
  const lo = leadingTones == null ? 0 : Math.max(0, tonicIndex - leadingTones)
  const hi = reachAboveTonic == null ? courses.length - 1 : Math.min(courses.length - 1, tonicIndex + reachAboveTonic)
  if (lo === 0 && hi === courses.length - 1) return courses
  // Re-index so the array stays 0-based + contiguous — the render + gesture
  // pipeline assumes course.index === array position.
  return courses.slice(lo, hi + 1).map((c, i) => ({ ...c, index: i }))
}
