import type { JinsPair, MandalState } from '../types'
import { applyLowerJins } from './lowerJins'
import { applyUpperJins } from './upperJins'

// The full Jins-mode tuning for a (lower, upper) pair, rebuilt from the lower
// jins's default scale every time — so the result depends only on the pair,
// never on which upper came before it (a wrapped leading tone or a short
// trichord's untouched degree can't leak from one choice into the next).
export const jinsTuning = ({ lowerId, upperId }: JinsPair): { mandalState: MandalState; homeDegree: number } => {
  const { mandalState, homeDegree } = applyLowerJins(lowerId)
  return { mandalState: applyUpperJins({ state: mandalState, upperId, homeDegree, lowerId }), homeDegree }
}
