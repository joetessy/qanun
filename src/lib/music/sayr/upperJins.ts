import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'
import { offsetOf, setMandal } from '../ajnas/MANDALS'
import { identifyAjnas } from '../identifyAjnas'

/**
 * Ordered idiomatic upper jins per root jins id.
 * The upper jins sits on the root's ghammāz degree.
 * The first entry is the "home" upper (standard maqam); subsequent entries are
 * the modulation options Arabic musicians reach with one lever-tap.
 */
export const FAMILY_UPPERS: Record<string, readonly string[]> = {
  rast:     ['rast', 'nahawand', 'hijaz', 'bayati'],
  bayati:   ['nahawand', 'rast', 'hijaz'],
  hijaz:    ['rast', 'nahawand', 'bayati'],
  nahawand: ['kurd', 'hijaz', 'bayati'],
  kurd:     ['nahawand', 'rast'],
  nikriz:   ['nahawand'],
  saba:     ['hijaz', 'ajam'],
  sikah:    ['hijaz', 'rast']
}

/**
 * Apply an upper jins on the ghammāz of the current root.
 * The root jins (degrees 1..ghammazDegree) is untouched; only the degrees
 * ABOVE the ghammāz are rewritten to match the upper jins's intervals.
 * If no root jins is identified, returns the state unchanged.
 */
export const applyUpperJins = (state: MandalState, upperId: string): MandalState => {
  const { lower } = identifyAjnas(state)
  if (!lower) return state

  const root = jinsById(lower)
  const upper = jinsById(upperId)
  const g = root.ghammazDegree
  const gOffset = offsetOf(state, g)

  let next = state.slice() as unknown as MandalState
  for (let i = 1; i < upper.intervals.length; i++) {
    const deg = g + i
    if (deg > 7) break
    next = setMandal(next, deg, gOffset + upper.intervals[i])
  }
  return next
}

/**
 * Return the id of the upper jins currently sitting on the ghammāz,
 * or null if identification fails.
 */
export const currentUpperJins = (state: MandalState): string | null =>
  identifyAjnas(state).upper

export interface UpperJinsOption {
  id: string
  /** Display label: the upper jins's own name, prefixed "Upper " when the
   *  upper jins id matches the root jins id (e.g. "Upper Rast" vs "Nahawand"). */
  label: string
  /** Full maqam name (e.g. "Maqam Rast") — suitable for use as a tooltip. */
  maqamName: string
  active: boolean
}

/**
 * Compute the list of upper-jins options for the current root, with labels
 * and active flags, suitable for rendering as a chip row.
 * Returns [] when the current state has no identifiable lower jins.
 */
export const upperOptions = (state: MandalState): UpperJinsOption[] => {
  const { lower } = identifyAjnas(state)
  if (!lower) return []

  const options = FAMILY_UPPERS[lower]
  if (!options) return []

  const active = currentUpperJins(state)
  return options.map((id) => {
    const jinsLabel = jinsById(id).label
    const label = id === lower ? `Upper ${jinsLabel}` : jinsLabel
    const applied = applyUpperJins(state, id)
    const maqamName = identifyAjnas(applied).maqamName
    return { id, label, maqamName, active: id === active }
  })
}
