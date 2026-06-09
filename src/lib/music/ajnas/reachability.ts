import type { Jins } from '../types'
import { DEGREE_COUNT, positionsForDegree } from './MANDALS'

// A jins is reachable at start degree s if there is a choice of mandal
// positions such that, placing the jins tonic on degree s, each successive
// note lands on a legal position of the corresponding higher degree. We only
// consider start degrees where the whole jins fits within the 7 field degrees
// (s + length - 1 <= 7), so no octave wrap is needed for the P1 core.
export const reachableStartDegrees = (jins: Jins): number[] => {
  const out: number[] = []
  const len = jins.intervals.length
  for (let s = 1; s + len - 1 <= DEGREE_COUNT; s++) {
    // Choose a base offset b from the start degree's positions, then require
    // b + interval[i] to be a legal position of degree (s + i) for every note.
    const baseChoices = positionsForDegree(s)
    const ok = baseChoices.some((b) =>
      jins.intervals.every((interval, i) =>
        positionsForDegree(s + i).includes(b + interval)
      )
    )
    if (ok) out.push(s)
  }
  return out
}

export const isJinsReachable = (jins: Jins): boolean =>
  reachableStartDegrees(jins).length > 0
