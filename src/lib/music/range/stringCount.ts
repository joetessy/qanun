import type { FieldRange } from '../types'

// How many strings a window holds (both ends included).
export const stringCount = ({ low, high }: FieldRange): number => high - low + 1
