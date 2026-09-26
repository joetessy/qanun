import type { MandalState } from '../types'
import { NATURAL_OFFSETS } from '../degreeLabel'

export const DEGREE_COUNT = 7

export interface MandalDegree {
  degree: number                 // 1..7
  natural: number                // the unaltered (lever-down) offset — C D E F G A B from a C tonic
  positions: readonly number[]   // ordered low → high (semitone offsets from tonic)
}

// How far a lever moves its string either way from natural, in semitones:
// two quarter-tones.
export const LEVER_REACH = 1

// Qanun-mode mandal positions: every course reaches two quarter-tones either
// side of its natural, the same five stops on all seven strings —
//   ♭ · ½♭ · ♮ · ½♯ · ♯
// so each lever moves the same way however it's set. The symmetric set keeps
// the enharmonic stops (E♯ = F, F♭ = E, B♯ = C, C♭ = B): a lever that reaches
// its neighbour's pitch is ordinary on a real qanun, and it means no string is
// ever one step short of its partner. Together the courses reach all 24
// quarter-tones, so any maqam can be spelled from any root.
export const MANDAL_DEGREES: readonly MandalDegree[] = NATURAL_OFFSETS.map((natural, i) => ({
  degree: i + 1,
  natural,
  positions: [natural - LEVER_REACH, natural - LEVER_REACH / 2, natural, natural + LEVER_REACH / 2, natural + LEVER_REACH]
}))

// Qanun mode's resting tuning: every lever at natural — C D E F G A B.
export const NATURAL_STATE: MandalState = [...NATURAL_OFFSETS]

// Jins mode's default tuning: Rast on the tonic.
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
