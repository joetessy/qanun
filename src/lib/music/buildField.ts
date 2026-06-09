import type { Course, MandalState } from './types'
import { DEGREE_COUNT, offsetOf } from './ajnas/MANDALS'
import { midiToFreq } from './midiToFreq'

// Anchor the field low enough to span the qanun's working range. C3 = MIDI 48;
// with 4 octaves the field reaches ~B♭6. The visible window can be narrowed in
// the component without changing this model.
export const DEFAULT_TONIC_MIDI = 48
export const FIELD_OCTAVES = 4
export const FIELD_OCTAVES_BELOW = 1
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
}

// Lay out the scale-locked string field: for each octave, one course per scale
// degree, ordered by (octave, degree) — the physical string order on a qanun.
// A glide across this array runs the current maqam by construction.
// The field starts octavesBelow octaves below the tonic (for leading tones); the
// total course count is always 7 * octaveCount.
export const buildField = ({
  tonicMidi,
  mandalState,
  octaveCount = FIELD_OCTAVES,
  octavesBelow = FIELD_OCTAVES_BELOW,
  detuneCents = 0
}: BuildFieldArgs): Course[] => {
  const courses: Course[] = []
  let index = 0
  const detuneSemitones = detuneCents / 100
  for (let octave = -octavesBelow; octave < octaveCount - octavesBelow; octave++) {
    for (let degree = 1; degree <= DEGREE_COUNT; degree++) {
      const midi = tonicMidi + 12 * octave + offsetOf(mandalState, degree)
      // Detune touches only the frequency, never the stored `midi` label.
      courses.push({ index, degree, octave, midi, freqHz: midiToFreq(midi + detuneSemitones) })
      index++
    }
  }
  return courses
}
