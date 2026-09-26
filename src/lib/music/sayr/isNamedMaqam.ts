import type { JinsPair } from '../types'
import { MAQAM_PAIR_NAMES } from './MAQAM_PAIR_NAMES'
import { lowerJinsById } from './lowerJins'

// True when (lower, upper) spells a recognised maqam: a named pairing, or one of
// the family's own common uppers. Anything else is a free combination.
export const isNamedMaqam = ({ lowerId, upperId }: JinsPair): boolean =>
  MAQAM_PAIR_NAMES[`${lowerId}|${upperId}`] !== undefined || lowerJinsById(lowerId).commonUppers.includes(upperId)
