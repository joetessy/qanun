import type { MandalState } from './types'

export interface MaqamPreset {
  id: string
  name: string
  mandalState: MandalState
}

// One-tap maqam tunings. Each entry maps a friendly preset id to the 7-degree
// mandal state that spells out that maqam from any tonic. States are the
// canonical tunings verified by identifyAjnas round-trip (see MAQAM_PRESETS.test.ts).
export const MAQAM_PRESETS: readonly MaqamPreset[] = [
  { id: 'rast',     name: 'Maqam Rast',     mandalState: [0, 2,   3.5, 5, 7, 9,   10.5] },
  { id: 'suznak',   name: 'Maqam Suznak',   mandalState: [0, 2,   3.5, 5, 7, 8,   11  ] },
  { id: 'nahawand', name: 'Maqam Nahawand', mandalState: [0, 2,   3,   5, 7, 8,   10  ] },
  { id: 'bayati',   name: 'Maqam Bayati',   mandalState: [0, 1.5, 3,   5, 7, 8,   10  ] },
  { id: 'hijaz',    name: 'Maqam Hijaz',    mandalState: [0, 1,   4,   5, 7, 8,   10  ] },
  { id: 'kurd',     name: 'Maqam Kurd',     mandalState: [0, 1,   3,   5, 7, 8,   10  ] },
  { id: 'nikriz',   name: 'Maqam Nikriz',   mandalState: [0, 2,   3,   6, 7, 9,   10  ] },
  { id: 'saba',     name: 'Maqam Saba',     mandalState: [0, 1.5, 3,   4, 7, 8,   11  ] },
]

export const presetById = (id: string): MaqamPreset | undefined =>
  MAQAM_PRESETS.find((p) => p.id === id)
