import type { Course } from './types'
import { degreeNoteLabel, NATURAL_OFFSETS } from './degreeLabel'

interface CourseNoteNameArgs {
  course: Course
  tonicMidi: number
}

// Names one string of the field as its lever spelling plus the octave of its
// natural letter, so a quarter-tone string reads as the note it is — "B½♭5",
// not "B5 −50¢". Flat-spelled, like the other absolute readouts.
export const courseNoteName = ({ course, tonicMidi }: CourseNoteNameArgs): string => {
  const base = tonicMidi + 12 * course.octave
  const label = degreeNoteLabel({ tonicMidi, degree: course.degree, offset: course.midi - base, flats: true })
  const naturalMidi = base + NATURAL_OFFSETS[course.degree - 1]
  return `${label}${Math.floor(naturalMidi / 12) - 1}`
}
