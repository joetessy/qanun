import type { Jins } from '../types'

// The Phase-1 jins core: the 9 ajnas that head maqam families plus Hijazkar.
// Intervals are semitones from the jins tonic (half-flat = .5). Transcribed
// from docs/MUSIC-THEORY.md §3 and docs/research/ajnas-reference.md.
//
// The full maqamat catalogue lives in the shared @yusuf/maqam-theory repo
// (~/Projects/maqam-theory, consumed by maqam-atlas and maqam-studio). This
// file stays separate on purpose: the instrument needs homeDegree and the
// playable 4-note Hijazkar [0,1,4,5] instead of the catalogue's overlapping
// theoretical form. Cross-check interval fixes against that repo by hand.
//
// Deferred to a later sub-plan (need the variant mandal positions): Sazkar,
// Nahawand Murassaʿ, Mukhalif Sharqi, Lami, Saba Zamzam, Athar Kurd, Jiharkah,
// Mustaʿar, ʿAjam(3), Upper Rast/Ajam.
export const JINS: readonly Jins[] = [
  { id: 'rast',     label: 'Rast',     intervals: [0, 2, 3.5, 5, 7], ghammazDegree: 5, homeDegree: 1 },
  { id: 'nahawand', label: 'Nahawand', intervals: [0, 2, 3, 5, 7],   ghammazDegree: 5, homeDegree: 1 },
  { id: 'ajam',     label: 'ʿAjam',    intervals: [0, 2, 4, 5, 7],   ghammazDegree: 5, homeDegree: 1 },
  { id: 'nikriz',   label: 'Nikriz',   intervals: [0, 2, 3, 6, 7],   ghammazDegree: 5, homeDegree: 1 },
  { id: 'bayati',   label: 'Bayati',   intervals: [0, 1.5, 3, 5],    ghammazDegree: 4, homeDegree: 1 },
  { id: 'kurd',     label: 'Kurd',     intervals: [0, 1, 3, 5],      ghammazDegree: 4, homeDegree: 1 },
  { id: 'hijaz',    label: 'Hijaz',    intervals: [0, 1, 4, 5],      ghammazDegree: 4, homeDegree: 1 },
  { id: 'hijazkar', label: 'Hijazkar', intervals: [0, 1, 4, 5],      ghammazDegree: 4, homeDegree: 1 },
  { id: 'saba',     label: 'Saba',     intervals: [0, 1.5, 3, 4],    ghammazDegree: 3, homeDegree: 1 },
  { id: 'sikah',    label: 'Sikah',    intervals: [0, 1.5, 3.5],     ghammazDegree: 3, homeDegree: 3 }
]

const BY_ID: ReadonlyMap<string, Jins> = new Map(JINS.map((j) => [j.id, j]))

export const jinsById = (id: string): Jins => {
  const j = BY_ID.get(id)
  if (!j) throw new Error(`Unknown jins id: ${id}`)
  return j
}
