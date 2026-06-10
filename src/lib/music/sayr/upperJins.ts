import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'
import { DEGREE_COUNT, offsetOf, setMandal } from '../ajnas/MANDALS'
import { lowerJinsById, maqamNameFor } from './lowerJins'

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
  if (upperId === 'hijazkar') {
    // Maqam Hijazkar: Nikriz on the ghammāz + a raised leading tone a semitone
    // below the home (the upper Hijaz wrapping the octave). A compound — it also
    // sets the sub-tonic (degree 1), unlike a normal upper-jins.
    let next = applyUpperJins(state, 'nikriz', homeDegree, lowerId) // sets A, B♭ above the ghammāz
    // raised leading tone: a semitone below the home degree's pitch
    next = setMandal(next, 1, offsetOf(state, homeDegree) - 1)
    return next
  }
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
  if (id === 'hijazkar') return 'Nikriz Hijazkar'
  return jinsById(id).label
}

// The contextual upper-jins chips for the current lower jins. `active` flags the
// CURRENTLY-SELECTED upper jins by id — NOT a re-analysis of the scale, which is
// ambiguous: a compound upper (Hijazkar also sets degree 1) makes a simpler upper
// (Nahawand) spuriously "match" the resulting state. Tracking the selection is exact.
export const upperOptions = (
  lowerId: string,
  currentUpperId: string
): UpperJinsOption[] =>
  lowerJinsById(lowerId).upperOptions.map((id) => ({
    id,
    label: upperLabel(id),
    maqamName: maqamNameFor(lowerId, id),
    active: id === currentUpperId
  }))
