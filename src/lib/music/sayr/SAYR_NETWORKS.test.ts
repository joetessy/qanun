import { describe, expect, it } from 'vitest'
import { SAYR_NETWORKS, type SayrMove } from './SAYR_NETWORKS'
import { presetById } from '../MAQAM_PRESETS'
import { JINS_PAIRS } from './jinsPairs'

const ALL_MAQAM_IDS = ['rast', 'suznak', 'nahawand', 'bayati', 'hijaz', 'kurd', 'nikriz', 'saba']

describe('SAYR_NETWORKS — structure', () => {
  it('has entries for all 8 core maqam ids', () => {
    for (const id of ALL_MAQAM_IDS) {
      expect(SAYR_NETWORKS).toHaveProperty(id)
      expect(SAYR_NETWORKS[id].length).toBeGreaterThanOrEqual(3)
      expect(SAYR_NETWORKS[id].length).toBeLessThanOrEqual(6)
    }
  })

  it('every apply.id resolves to a real preset or jins-pair', () => {
    for (const [maqamId, moves] of Object.entries(SAYR_NETWORKS)) {
      for (const move of moves as SayrMove[]) {
        if (move.apply.kind === 'preset') {
          expect(
            presetById(move.apply.id),
            `${maqamId}: apply.id '${move.apply.id}' is not a valid preset`
          ).toBeDefined()
        } else {
          expect(
            JINS_PAIRS.find((p) => p.id === move.apply.id),
            `${maqamId}: apply.id '${move.apply.id}' is not a valid jins-pair`
          ).toBeDefined()
        }
      }
    }
  })

  it("Rast's first move targets preset 'suznak'", () => {
    const rastMoves = SAYR_NETWORKS['rast']
    expect(rastMoves[0].apply.kind).toBe('preset')
    expect((rastMoves[0].apply as { kind: 'preset'; id: string }).id).toBe('suznak')
  })

  it('every move has a non-empty label and a valid relationship', () => {
    const validRelationships = ['jins-pair', 'upper-jins', 'shared-ghammaz', 'tonic-recolor']
    for (const moves of Object.values(SAYR_NETWORKS)) {
      for (const move of moves as SayrMove[]) {
        expect(move.label.length).toBeGreaterThan(0)
        expect(validRelationships).toContain(move.relationship)
      }
    }
  })
})
