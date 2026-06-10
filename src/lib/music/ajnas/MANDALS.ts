import type { MandalState } from '../types'

export const DEGREE_COUNT = 7

export interface MandalDegree {
  degree: number                 // 1..7
  positions: readonly number[]   // ordered low → high (semitone offsets from tonic)
  fixed: boolean                 // true for the pillar degrees (single position)
}

// The qanun mandal positions (docs/MUSIC-THEORY.md §5, spec §2.2), transcribed
// verbatim. Only degree 1 (the tonic) is a fixed pillar. Degree 5 is now
// variable (positions 6 / 6.5 / 7 = G♭ / G½♭ / G) so that Hijaz and Bayati
// upper-jins families rooted on the ghammāz can reach their altered 5th.
export const MANDAL_DEGREES: readonly MandalDegree[] = [
  { degree: 1, positions: [0],            fixed: true  },
  { degree: 2, positions: [1, 1.5, 2],    fixed: false },
  { degree: 3, positions: [3, 3.5, 4],    fixed: false },
  { degree: 4, positions: [4, 5, 6],      fixed: false },
  { degree: 5, positions: [6, 6.5, 7],    fixed: false },
  { degree: 6, positions: [8, 8.5, 9],    fixed: false },
  { degree: 7, positions: [10, 10.5, 11], fixed: false }
]

// Default tuning: Rast on the tonic.
export const DEFAULT_RAST_STATE: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]

export const positionsForDegree = (degree: number): readonly number[] =>
  MANDAL_DEGREES[degree - 1].positions

export const offsetOf = (state: MandalState, degree: number): number =>
  state[degree - 1]

export const setMandal = (
  state: MandalState,
  degree: number,
  offset: number
): MandalState => {
  const next = state.slice()
  next[degree - 1] = offset
  return next
}
