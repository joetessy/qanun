import type { MandalState } from '../types'

export const DEGREE_COUNT = 7

export interface MandalDegree {
  degree: number                 // 1..7
  positions: readonly number[]   // ordered low → high (semitone offsets from tonic)
}

// Qanun-mode mandal positions: each note's full set of useful inflections — every
// quarter-tone that sits strictly BETWEEN its diatonic neighbours. Together the
// seven courses reach all 24 quarter-tones, so any common maqam can be spelled
// from any root (e.g. Rast-on-G needs B½♭ on degree 7 and F½♯ on degree 4, both
// reachable). The asymmetry is principled, not arbitrary: a note a whole tone
// from its neighbour gets the chromatic step (♭/♯) plus the quarter between; a
// note only a SEMITONE from its neighbour (E→F, B→C) has no room for that extra
// step on the crowded side, so it has one fewer position there. The tonic
// (degree 1) only rises from natural — it anchors the key, and the pitch just
// below it is already reachable as degree 7's B½♯.
//   1 C : C  · C½♯ · C♯
//   2 D : D♭ · D½♭ · D · D½♯ · D♯
//   3 E : E♭ · E½♭ · E · E½♯            (no E♯ — that's F)
//   4 F : F½♭ · F · F½♯ · F♯            (no F♭ — that's E)
//   5 G : G♭ · G½♭ · G · G½♯ · G♯
//   6 A : A♭ · A½♭ · A · A½♯ · A♯
//   7 B : B♭ · B½♭ · B · B½♯            (no B♯ — that's C)
export const MANDAL_DEGREES: readonly MandalDegree[] = [
  { degree: 1, positions: [0, 0.5, 1] },
  { degree: 2, positions: [1, 1.5, 2, 2.5, 3] },
  { degree: 3, positions: [3, 3.5, 4, 4.5] },
  { degree: 4, positions: [4.5, 5, 5.5, 6] },
  { degree: 5, positions: [6, 6.5, 7, 7.5, 8] },
  { degree: 6, positions: [8, 8.5, 9, 9.5, 10] },
  { degree: 7, positions: [10, 10.5, 11, 11.5] }
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

// Step a degree's chosen offset one position in a direction. dir = +1 moves
// sharper (up the positions list), −1 flatter (down); CLAMPS at the ends (no
// wrap) so a directional key never jumps from sharpest to flattest. positions are
// ordered low → high. If `current` isn't a legal position, snap to the nearest end
// for that direction so a stray offset still resolves.
export const stepMandalPosition = (
  positions: readonly number[],
  current: number,
  dir: 1 | -1
): number => {
  const n = positions.length
  if (n === 0) return current
  const i = positions.indexOf(current)
  if (i === -1) return positions[dir > 0 ? 0 : n - 1]
  const next = i + dir
  if (next < 0 || next >= n) return current // clamp at the ends
  return positions[next]
}
