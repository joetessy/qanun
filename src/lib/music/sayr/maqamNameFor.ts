import type { JinsPair } from '../types'
import { jinsById } from '../ajnas/JINS'
import { MAQAM_PAIR_NAMES } from './MAQAM_PAIR_NAMES'
import { lowerJinsById } from './lowerJins'

// "Maqam Suznak" for a named pairing, "Maqam Bayati" for a family's common
// upper, else the bare pairing "Rast ▸ Kurd" (the identifyAjnas convention) so
// the readout never claims a free combination is the family's own maqam.
export const maqamNameFor = ({ lowerId, upperId }: JinsPair): string => {
  const named = MAQAM_PAIR_NAMES[`${lowerId}|${upperId}`]
  if (named) return named
  const lower = jinsById(lowerId).label
  return lowerJinsById(lowerId).commonUppers.includes(upperId)
    ? `Maqam ${lower}`
    : `${lower} ▸ ${jinsById(upperId).label}`
}
