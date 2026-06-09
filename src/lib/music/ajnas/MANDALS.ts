import type { MandalState } from '../types'

export const DEGREE_COUNT = 7

export interface MandalDegree {
  degree: number                 // 1..7
  positions: readonly number[]   // ordered low → high (semitone offsets from tonic)
  fixed: boolean                 // true for the pillar degrees (single position)
}

// The qanun mandal positions (docs/MUSIC-THEORY.md §5, spec §2.2), transcribed
// verbatim. Degrees 1 and 5 are fixed pillars in P1. (A later sub-plan that
// adds Sazkar / Nahawand Murassaʿ / Mukhalif gains offset 3 on degree 2 and
// offset 6 on degree 5 — not needed for the P1 jins core.)
export const MANDAL_DEGREES: readonly MandalDegree[] = [
  { degree: 1, positions: [0],            fixed: true },
  { degree: 2, positions: [1, 1.5, 2],    fixed: false },
  { degree: 3, positions: [3, 3.5, 4],    fixed: false },
  { degree: 4, positions: [4, 5, 6],      fixed: false },
  { degree: 5, positions: [7],            fixed: true },
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

// Move a degree to its next/previous legal position. Clamps at the ends (no
// wrap) so a flick past the top/bottom is a predictable no-op. Fixed pillar
// degrees never move.
export const cycleMandal = (
  state: MandalState,
  degree: number,
  direction: 1 | -1
): MandalState => {
  const md = MANDAL_DEGREES[degree - 1]
  if (md.fixed) return state
  const current = offsetOf(state, degree)
  const i = md.positions.indexOf(current)
  // If the current offset isn't a known position, treat it as below the floor
  // (when cycling up) or above the ceiling (when cycling down), so one flick
  // always lands on a valid position and subsequent flicks proceed normally.
  const fromIndex = i === -1 ? (direction === 1 ? -1 : md.positions.length) : i
  const nextIndex = Math.min(md.positions.length - 1, Math.max(0, fromIndex + direction))
  return setMandal(state, degree, md.positions[nextIndex])
}
