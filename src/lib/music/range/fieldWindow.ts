import type { FieldRange } from '../types'

// buildField's window arguments for a range: the strings to keep below and
// above the tonic. Either may be negative — a window that starts above the
// tonic (or ends below it) simply leaves the tonic string out.
export const fieldWindow = ({ low, high }: FieldRange): { leadingTones: number; reachAboveTonic: number } =>
  ({ leadingTones: -low, reachAboveTonic: high })
