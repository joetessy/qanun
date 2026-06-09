import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'
import { offsetOf, setMandal } from '../ajnas/MANDALS'
import { lowerJinsById, maqamNameFor } from './lowerJins'

const DEGREE_COUNT = 7

const lowerGhammaz = (lowerId: string): number => jinsById(lowerId).ghammazDegree

// Field degree (1..7) the upper jins sits on = the lower jins's ghammāz (from
// JINS) shifted by the home degree. e.g. Bayati home 2, ghammāz 4 → degree 5 (G).
export const ghammazFieldDegree = (lowerId: string, homeDegree: number): number =>
  homeDegree + lowerGhammaz(lowerId) - 1

// Apply an upper jins on the ghammāz of the current (home-anchored) lower jins.
// Only degrees ABOVE the ghammāz are rewritten; the lower tetrachord + home are
// untouched. Degrees beyond 7 are dropped (no wrap into the next octave).
export const applyUpperJins = (
  state: MandalState,
  upperId: string,
  homeDegree: number,
  lowerId: string
): MandalState => {
  const ghammaz = ghammazFieldDegree(lowerId, homeDegree)
  if (ghammaz < 1 || ghammaz > DEGREE_COUNT) return state
  const gOffset = offsetOf(state, ghammaz)
  const upper = jinsById(upperId)
  let next = state.slice() as unknown as MandalState
  for (let i = 1; i < upper.intervals.length; i++) {
    const deg = ghammaz + i
    if (deg > DEGREE_COUNT) break
    next = setMandal(next, deg, gOffset + upper.intervals[i])
  }
  return next
}

export interface UpperJinsOption {
  id: string
  label: string
  maqamName: string // "Maqam <name>" for (lower, this-upper) — used as the chip tooltip
  active: boolean
}

const upperLabel = (id: string): string => {
  if (id === 'rast') return 'Upper Rast'
  if (id === 'ajam') return 'Upper ʿAjam'
  return jinsById(id).label
}

const arraysEqual = (a: MandalState, b: MandalState): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

// The contextual upper-jins chips for the current lower jins. `active` = the
// option whose application leaves the state unchanged (the current upper).
export const upperOptions = (
  lowerId: string,
  state: MandalState,
  homeDegree: number
): UpperJinsOption[] =>
  lowerJinsById(lowerId).upperOptions.map((id) => ({
    id,
    label: upperLabel(id),
    maqamName: maqamNameFor(lowerId, id),
    active: arraysEqual(applyUpperJins(state, id, homeDegree, lowerId), state)
  }))
