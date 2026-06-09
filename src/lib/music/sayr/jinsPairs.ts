import type { MandalState } from '../types'
import { offsetOf, setMandal } from '../ajnas/MANDALS'

// A jins pair is a single-mandal flip between two named ajnas (spec §2.4).
export interface JinsPair {
  id: string
  fromLabel: string
  toLabel: string
  degree: number    // the one mandal degree that moves
  offsetA: number   // the "from" pole
  offsetB: number   // the "to" pole
}

// Phase-1 pairs realizable with the literal mandal table. The other three
// canonical pairs (Rast↔Sazkar, Nahawand↔Nahawand Murassaʿ, Sikah↔Mukhalif)
// need the deferred variant ajnas + extra mandal positions — add them with
// those ajnas in a later sub-plan.
export const JINS_PAIRS: readonly JinsPair[] = [
  { id: 'bayati-saba',     fromLabel: 'Bayati', toLabel: 'Saba',     degree: 4, offsetA: 5,  offsetB: 4 },
  { id: 'hijaz-hijazkar',  fromLabel: 'Hijaz',  toLabel: 'Hijazkar', degree: 7, offsetA: 10, offsetB: 11 }
]

// Documented non-pair: same one-note mechanism, but idiomatically a dramatic
// contrast rather than a fluid swap (spec §2.4 / sayr-reference §5).
export const EXCLUDED_PAIRS: readonly string[] = ['nahawand-nikriz']

// Toggle the pair's degree between its two poles. If the degree sits on
// neither pole, snap to offsetA (a deterministic, single-flip result).
export const applyJinsPair = (state: MandalState, pair: JinsPair): MandalState => {
  const current = offsetOf(state, pair.degree)
  const next = current === pair.offsetA ? pair.offsetB : pair.offsetA
  return setMandal(state, pair.degree, next)
}

export const isPairActive = (state: MandalState, pair: JinsPair): boolean => {
  const current = offsetOf(state, pair.degree)
  return current === pair.offsetA || current === pair.offsetB
}
