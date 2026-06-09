// emphasisNotes: returns course indices to highlight per the sayr reference §3.
// Highlights: tonic (degree 1), ghammaz (lower jins's ghammazDegree, default 5),
// octave (tonic courses at octave >= 1), leadingTone (degree 7).
import type { Course, MandalState } from '../types'
import { identifyAjnas } from '../identifyAjnas'
import { jinsById } from '../ajnas/JINS'

export interface EmphasisNotes {
  tonic: number[]        // course indices with degree === 1
  ghammaz: number[]      // course indices with degree === ghammazDegree
  octave: number[]       // tonic course indices at octave >= 1
  leadingTone: number[]  // course indices with degree === 7
}

export interface EmphasisNotesArgs {
  mandalState: MandalState
  courses: Course[]
}

export const emphasisNotes = ({ mandalState, courses }: EmphasisNotesArgs): EmphasisNotes => {
  // Determine the ghammaz degree from the lower jins; default 5.
  const identity = identifyAjnas(mandalState)
  let ghammazDegree = 5
  if (identity.lower) {
    try {
      ghammazDegree = jinsById(identity.lower).ghammazDegree
    } catch {
      ghammazDegree = 5
    }
  }

  const tonic: number[] = []
  const ghammaz: number[] = []
  const octave: number[] = []
  const leadingTone: number[] = []

  for (const course of courses) {
    if (course.degree === 1) {
      tonic.push(course.index)
      if (course.octave >= 1) octave.push(course.index)
    }
    if (course.degree === ghammazDegree) {
      ghammaz.push(course.index)
    }
    if (course.degree === 7) {
      leadingTone.push(course.index)
    }
  }

  return { tonic, ghammaz, octave, leadingTone }
}
