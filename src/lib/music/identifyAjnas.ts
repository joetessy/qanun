import type { AjnasIdentity, Jins, MandalState } from './types'
import { JINS } from './ajnas/JINS'
import { offsetOf } from './ajnas/MANDALS'
import { lookupMaqamName } from './MAQAM_NAMES'

// Field offsets relative to the tonic: degrees 1..7, plus degrees 1–2 of the
// next octave (as 12 + offset). Those two extras are all that's needed — the
// longest upper jins is 5 notes and roots no later than field degree 5, so a
// pentachord upper on the ghammāz reads degrees 5..9.
const extendedOffsets = (state: MandalState): number[] => {
  const base = [1, 2, 3, 4, 5, 6, 7].map((d) => offsetOf(state, d))
  return [...base, 12 + offsetOf(state, 1), 12 + offsetOf(state, 2)]
}

const arraysEqual = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

// Find the jins whose full interval vector equals the field offsets starting at
// `startDegree` (rebased to 0). Prefer the LONGEST exact match; break ties by
// JINS declaration order. `homeFilter` restricts to jins that idiomatically
// root at that degree (so the half-flat-tonic trichords aren't matched at 1).
const matchJins = (
  offsets: readonly number[],
  startDegree: number,
  homeFilter: (j: Jins) => boolean
): Jins | null => {
  const base = offsets[startDegree - 1]
  const rebased = offsets.slice(startDegree - 1).map((o) => o - base)
  const candidates = JINS.filter(homeFilter)
    .filter((j) => j.intervals.length <= rebased.length)
    .filter((j) => arraysEqual(j.intervals, rebased.slice(0, j.intervals.length)))
    .sort((a, b) => b.intervals.length - a.intervals.length)
  return candidates[0] ?? null
}

export const identifyAjnas = (state: MandalState): AjnasIdentity => {
  const offsets = extendedOffsets(state)

  // Lower jins roots on degree 1 (only jins with homeDegree 1 qualify).
  const lower = matchJins(offsets, 1, (j) => j.homeDegree === 1)
  if (!lower) return { lower: null, upper: null, maqamName: 'custom' }

  // Upper jins roots on the lower jins's ghammāz degree. Allow any jins
  // (the upper jins of the core maqamat are all family heads).
  const upper = matchJins(offsets, lower.ghammazDegree, () => true)

  if (!upper) {
    return { lower: lower.id, upper: null, maqamName: lower.label }
  }

  const named = lookupMaqamName(lower.id, upper.id, lower.ghammazDegree)
  const maqamName = named ?? `${lower.label} ▸ ${upper.label}`
  return { lower: lower.id, upper: upper.id, maqamName }
}
