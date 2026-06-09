// suggestModulations: given a MandalState, returns the ordered list of idiomatic
// next modulation moves, filtered to exclude the current active state.
// Falls back to applicable jins-pairs for uncatalogued/custom states.
import type { MandalState } from '../types'
import type { SayrMove } from './SAYR_NETWORKS'
import { SAYR_NETWORKS } from './SAYR_NETWORKS'
import { JINS_PAIRS, isPairActive } from './jinsPairs'
import { MAQAM_PRESETS } from '../MAQAM_PRESETS'
import { identifyAjnas } from '../identifyAjnas'

// Returns the preset id whose mandalState matches the given state, or null.
const activePresetId = (state: MandalState): string | null => {
  for (const preset of MAQAM_PRESETS) {
    if (
      preset.mandalState.length === state.length &&
      preset.mandalState.every((v, i) => v === state[i])
    ) {
      return preset.id
    }
  }
  return null
}

// Returns the set of jins-pair ids whose poles contain the current degree value
// (i.e., pair is relevant/applicable to this state).
const applicablePairMoves = (state: MandalState): SayrMove[] =>
  JINS_PAIRS
    .filter((pair) => isPairActive(state, pair))
    .map((pair) => ({
      label: `${pair.fromLabel} ↔ ${pair.toLabel}`,
      relationship: 'jins-pair' as const,
      apply: { kind: 'pair' as const, id: pair.id }
    }))

export const suggestModulations = (state: MandalState): SayrMove[] => {
  const identity = identifyAjnas(state)
  const currentPresetId = activePresetId(state)

  // Find the maqam id to look up the network.
  // Use the lower jins id first (it matches the SAYR_NETWORKS keys for core maqamat).
  let networkKey: string | null = null
  if (currentPresetId && SAYR_NETWORKS[currentPresetId]) {
    networkKey = currentPresetId
  } else if (identity.lower && SAYR_NETWORKS[identity.lower]) {
    networkKey = identity.lower
  }

  // Build the base suggestions from the network.
  let moves: SayrMove[] = []
  if (networkKey) {
    moves = SAYR_NETWORKS[networkKey]
      .filter((move) => {
        // Exclude the current preset from the suggestions.
        if (move.apply.kind === 'preset' && move.apply.id === currentPresetId) return false
        return true
      })
      .slice() // copy the readonly array
  }

  // Always append any applicable jins-pairs not already listed.
  const listedPairIds = new Set(
    moves.filter((m) => m.apply.kind === 'pair').map((m) => m.apply.id)
  )
  const extraPairs = applicablePairMoves(state).filter((m) => !listedPairIds.has(m.apply.id))
  moves = [...moves, ...extraPairs]

  // For custom / uncatalogued states (no network key), return jins-pairs only.
  if (!networkKey) {
    return applicablePairMoves(state)
  }

  return moves
}
