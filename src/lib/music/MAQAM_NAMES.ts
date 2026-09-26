// Friendly maqam names keyed by (lower jins id, upper jins id, ghammāz degree).
// Phase-1 set — the degree-1-rooted families plus Saba (ghammāz on 3).
export interface MaqamNameEntry {
  lower: string
  upper: string
  ghammazDegree: number
  name: string
}

export const MAQAM_NAMES: readonly MaqamNameEntry[] = [
  { lower: 'rast',     upper: 'rast',     ghammazDegree: 5, name: 'Maqam Rast' },
  { lower: 'rast',     upper: 'nahawand', ghammazDegree: 5, name: 'Maqam Rast' },
  { lower: 'rast',     upper: 'hijaz',    ghammazDegree: 5, name: 'Maqam Suznak' },
  { lower: 'nahawand', upper: 'kurd',     ghammazDegree: 5, name: 'Maqam Nahawand' },
  { lower: 'nahawand', upper: 'hijaz',    ghammazDegree: 5, name: 'Maqam Nahawand' },
  { lower: 'bayati',   upper: 'nahawand', ghammazDegree: 4, name: 'Maqam Bayati' },
  { lower: 'bayati',   upper: 'rast',     ghammazDegree: 4, name: 'Maqam Bayati' },
  { lower: 'hijaz',    upper: 'nahawand', ghammazDegree: 4, name: 'Maqam Hijaz' },
  { lower: 'hijaz',    upper: 'rast',     ghammazDegree: 4, name: 'Maqam Hijaz' },
  { lower: 'kurd',     upper: 'nahawand', ghammazDegree: 4, name: 'Maqam Kurd' },
  { lower: 'nikriz',   upper: 'nahawand', ghammazDegree: 5, name: 'Maqam Nikriz' },
  { lower: 'saba',     upper: 'hijaz',    ghammazDegree: 3, name: 'Maqam Saba' }
]

export const lookupMaqamName = (
  lower: string,
  upper: string,
  ghammazDegree: number
): string | null =>
  MAQAM_NAMES.find(
    (m) => m.lower === lower && m.upper === upper && m.ghammazDegree === ghammazDegree
  )?.name ?? null
