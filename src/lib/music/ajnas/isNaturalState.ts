import type { MandalState } from '../types'
import { NATURAL_STATE } from './MANDALS'

// True when every lever rests on its natural — C D E F G A B.
export const isNaturalState = (state: MandalState): boolean =>
  state.every((offset, i) => offset === NATURAL_STATE[i])
