import { jinsById } from '../ajnas/JINS'
import { lowerJinsList, type LowerJins } from './lowerJins'

// The families that can sit on a ghammāz as the upper jins, in the lower rail's
// order (so each keeps its column): every family but the lower-only ones —
// Sikah only ever starts a maqam.
export const upperJinsFamilies = (): readonly LowerJins[] =>
  lowerJinsList().filter(({ id }) => !jinsById(id).lowerOnly)
