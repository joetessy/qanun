import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'
import { DEGREE_COUNT, offsetOf, setMandal } from '../ajnas/MANDALS'
import { upperJinsFamilies } from './upperJinsFamilies'
import { isNamedMaqam } from './isNamedMaqam'
import { maqamNameFor } from './maqamNameFor'

const lowerGhammaz = (lowerId: string): number => jinsById(lowerId).ghammazDegree

// Field degree (1..7) the upper jins sits on = the lower jins's ghammāz (from
// JINS) shifted by the home degree. e.g. Bayati home 2, ghammāz 4 → degree 5 (G).
export const ghammazFieldDegree = (lowerId: string, homeDegree: number): number =>
  homeDegree + lowerGhammaz(lowerId) - 1

interface ApplyUpperJinsArgs {
  state: MandalState
  upperId: string
  homeDegree: number
  lowerId: string
}

// Apply an upper jins on the ghammāz of the current (home-anchored) lower jins.
// The lower jins's own notes — home up to the ghammāz — are never rewritten.
// Upper notes that run past degree 7 wrap into the next octave's courses (the
// mandals are octave-global): one that lands back on the lower jins is dropped
// (a pentachord's octave over Rast is the home itself), but one that lands
// UNDER the home of a D- or E½♭-rooted jins retunes that sub-tonic string.
// That wrap is Maqam Hijazkar: Nikriz on Hijaz's ghammāz G reaches G A B♭ C♯,
// and the C♯ becomes the raised leading tone — on EVERY degree-1 string, below
// the home as well as above. That's deliberate (revisited 2026-07: classical
// Hijazkar carries the raised 7th under the tonic too — descents run D → C♯,
// not D → C).
export const applyUpperJins = ({ state, upperId, homeDegree, lowerId }: ApplyUpperJinsArgs): MandalState => {
  const ghammaz = ghammazFieldDegree(lowerId, homeDegree)
  if (ghammaz < 1 || ghammaz > DEGREE_COUNT) return state
  const gOffset = offsetOf(state, ghammaz)
  const upper = jinsById(upperId)
  let next: MandalState = state.slice()
  for (let i = 1; i < upper.intervals.length; i++) {
    const wraps = Math.floor((ghammaz + i - 1) / DEGREE_COUNT)
    const deg = ghammaz + i - wraps * DEGREE_COUNT
    if (deg >= homeDegree && deg <= ghammaz) continue // the lower jins's own note
    next = setMandal(next, deg, gOffset + upper.intervals[i] - 12 * wraps)
  }
  return next
}

export interface UpperJinsOption {
  id: string
  label: string
  maqamName: string // what (lower, this-upper) spells — "Maqam Suznak" or "Rast ▸ Kurd"; the chip tooltip
  named: boolean    // the pair is a recognised maqam, not a free combination
  active: boolean
}

interface UpperOptionsArgs {
  lowerId: string
  currentUpperId: string
}

// Every family that can be an upper jins (all but Sikah), offered on any lower
// — in the lower rail's order, so a family keeps its column (and key) in both
// rows. `active` flags the CURRENTLY-SELECTED upper by id, not a re-analysis
// of the scale: two uppers can leave the same notes above the ghammāz, and only
// the selection says which one the player chose.
export const upperOptions = ({ lowerId, currentUpperId }: UpperOptionsArgs): UpperJinsOption[] =>
  upperJinsFamilies().map(({ id }) => ({
    id,
    label: jinsById(id).label,
    maqamName: maqamNameFor({ lowerId, upperId: id }),
    named: isNamedMaqam({ lowerId, upperId: id }),
    active: id === currentUpperId
  }))
