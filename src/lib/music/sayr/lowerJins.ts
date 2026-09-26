import type { MandalState } from '../types'

export interface LowerJins {
  id: string
  label: string
  homeDegree: number              // 1, 2, or 3 — the field degree the tonic anchors on
  defaultScale: readonly number[] // 7 offsets from the key (degree 1 = 0)
  // The upper ajnas this family conventionally pairs with, ordered; the first is
  // the default when the family is picked. ANY jins may sit on top (see
  // upperOptions) — this list only decides the default and which pairings
  // still read as the family's own maqam ("Maqam <family>", see maqamNameFor).
  commonUppers: readonly string[]
}

// Default scales are offsets from the key (degree 1). Bayati/Sikah reuse the Rast
// collection (only the home moves — no note change from Rast). See
// docs/superpowers/specs/2026-06-09-jins-driven-modulation-design.md.
export const LOWER_JINS: readonly LowerJins[] = [
  { id: 'rast',     label: 'Rast',     homeDegree: 1, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5], commonUppers: ['rast', 'nahawand', 'hijaz', 'bayati'] },
  { id: 'bayati',   label: 'Bayati',   homeDegree: 2, defaultScale: [0, 2, 3.5, 5, 7, 9, 10],   commonUppers: ['nahawand', 'rast', 'hijaz'] },
  { id: 'hijaz',    label: 'Hijaz',    homeDegree: 2, defaultScale: [0, 2, 3, 6, 7, 9, 10.5],   commonUppers: ['rast', 'nahawand', 'bayati', 'nikriz'] },
  { id: 'nahawand', label: 'Nahawand', homeDegree: 1, defaultScale: [0, 2, 3, 5, 7, 8, 11],     commonUppers: ['hijaz', 'kurd', 'bayati', 'ajam', 'rast'] },
  { id: 'kurd',     label: 'Kurd',     homeDegree: 2, defaultScale: [0, 2, 3, 5, 7, 9, 10],      commonUppers: ['nahawand', 'rast'] },
  { id: 'nikriz',   label: 'Nikriz',   homeDegree: 1, defaultScale: [0, 2, 3, 6, 7, 9, 10],      commonUppers: ['nahawand'] },
  { id: 'ajam',     label: 'ʿAjam',    homeDegree: 1, defaultScale: [0, 2, 4, 5, 7, 9, 11],      commonUppers: ['ajam', 'hijaz', 'nahawand'] },
  { id: 'saba',     label: 'Saba',     homeDegree: 2, defaultScale: [0, 2, 3.5, 5, 6, 9, 10],    commonUppers: ['hijaz', 'ajam'] },
  { id: 'sikah',    label: 'Sikah',    homeDegree: 3, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5],  commonUppers: ['rast', 'nahawand', 'hijaz', 'bayati'] }
]

const BY_ID: ReadonlyMap<string, LowerJins> = new Map(LOWER_JINS.map((j) => [j.id, j]))

export const lowerJinsList = (): readonly LowerJins[] => LOWER_JINS

export const lowerJinsById = (id: string): LowerJins => {
  const j = BY_ID.get(id)
  if (!j) throw new Error(`Unknown lower jins: ${id}`)
  return j
}

export const applyLowerJins = (id: string): { mandalState: MandalState; homeDegree: number } => {
  const j = lowerJinsById(id)
  return { mandalState: j.defaultScale.slice(), homeDegree: j.homeDegree }
}
