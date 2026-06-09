import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'

export interface LowerJins {
  id: string
  label: string
  homeDegree: number              // 1, 2, or 3 — the field degree the tonic anchors on
  defaultScale: readonly number[] // 7 offsets from the key (degree 1 = 0)
  upperOptions: readonly string[] // upper jins ids, ordered; first = default highlight
}

// Default scales are offsets from the key (degree 1). Bayati/Sikah reuse the Rast
// collection (only the home moves — no note change from Rast). See
// docs/superpowers/specs/2026-06-09-jins-driven-modulation-design.md.
export const LOWER_JINS: readonly LowerJins[] = [
  { id: 'rast',     label: 'Rast',     homeDegree: 1, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5], upperOptions: ['rast', 'nahawand', 'hijaz', 'bayati'] },
  { id: 'bayati',   label: 'Bayati',   homeDegree: 2, defaultScale: [0, 2, 3.5, 5, 7, 9, 10],   upperOptions: ['nahawand', 'rast', 'hijaz'] },
  { id: 'hijaz',    label: 'Hijaz',    homeDegree: 2, defaultScale: [0, 2, 3, 6, 7, 9, 10.5],   upperOptions: ['rast', 'nahawand', 'bayati', 'hijazkar'] },
  { id: 'nahawand', label: 'Nahawand', homeDegree: 1, defaultScale: [0, 2, 3, 5, 7, 8, 11],     upperOptions: ['hijaz', 'kurd', 'bayati', 'ajam'] },
  { id: 'kurd',     label: 'Kurd',     homeDegree: 2, defaultScale: [0, 2, 3, 5, 7, 9, 10],      upperOptions: ['nahawand', 'rast'] },
  { id: 'nikriz',   label: 'Nikriz',   homeDegree: 1, defaultScale: [0, 2, 3, 6, 7, 9, 10],      upperOptions: ['nahawand'] },
  { id: 'ajam',     label: 'ʿAjam',    homeDegree: 1, defaultScale: [0, 2, 4, 5, 7, 9, 11],      upperOptions: ['ajam', 'hijaz', 'nahawand'] },
  { id: 'saba',     label: 'Saba',     homeDegree: 2, defaultScale: [0, 2, 3.5, 5, 6, 8, 10],    upperOptions: ['hijaz', 'ajam'] },
  { id: 'sikah',    label: 'Sikah',    homeDegree: 3, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5],  upperOptions: ['rast', 'nahawand', 'hijaz'] }
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

const SPECIAL_NAMES: Record<string, string> = {
  'rast|hijaz': 'Maqam Suznak',
  'rast|bayati': 'Maqam Nairuz',
  'bayati|hijaz': 'Maqam Bayati Shuri',
  'sikah|hijaz': 'Maqam Huzam',
  'nahawand|ajam': 'Maqam Nahawand Murassaʿ',
  'hijaz|hijazkar': 'Maqam Hijazkar'
}

export const maqamNameFor = (lowerId: string, upperId: string): string =>
  SPECIAL_NAMES[`${lowerId}|${upperId}`] ?? `Maqam ${jinsById(lowerId).label}`
