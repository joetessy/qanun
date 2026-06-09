import type { Course, MandalState } from './types'
import { DEGREE_COUNT, offsetOf } from './ajnas/MANDALS'
import { midiToFreq } from './midiToFreq'

// Anchor the field low enough to span the qanun's working range. C3 = MIDI 48;
// with 4 octaves the field reaches ~B♭6. The visible window can be narrowed in
// the component without changing this model.
export const DEFAULT_TONIC_MIDI = 48
export const FIELD_OCTAVES = 4
export const FIELD_OCTAVES_BELOW = 1

export interface BuildFieldArgs {
  tonicMidi: number
  mandalState: MandalState
  octaveCount?: number
  octavesBelow?: number
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
  octavesBelow = FIELD_OCTAVES_BELOW
}: BuildFieldArgs): Course[] => {
  const courses: Course[] = []
  let index = 0
  for (let octave = -octavesBelow; octave < octaveCount - octavesBelow; octave++) {
    for (let degree = 1; degree <= DEGREE_COUNT; degree++) {
      const midi = tonicMidi + 12 * octave + offsetOf(mandalState, degree)
      courses.push({ index, degree, octave, midi, freqHz: midiToFreq(midi) })
      index++
    }
  }
  return courses
}
