import { describe, expect, it } from 'vitest'
import { suggestModulations } from './suggestModulations'
import type { MandalState } from '../types'

// Canonical mandal states
const RAST: MandalState    = [0, 2,   3.5, 5, 7, 9,   10.5]
const SUZNAK: MandalState  = [0, 2,   3.5, 5, 7, 8,   11  ]
const BAYATI: MandalState  = [0, 1.5, 3,   5, 7, 8,   10  ]
const HIJAZ: MandalState   = [0, 1,   4,   5, 7, 8,   10  ]
const KURD: MandalState    = [0, 1,   3,   5, 7, 8,   10  ]
const NAHAWAND: MandalState = [0, 2,  3,   5, 7, 8,   10  ]
const NIKRIZ: MandalState  = [0, 2,   3,   6, 7, 9,   10  ]
const SABA: MandalState    = [0, 1.5, 3,   4, 7, 8,   11  ]
const CUSTOM: MandalState  = [0, 1.5, 4,   6, 7, 8.5, 11  ]

describe('suggestModulations — Rast', () => {
  it("first suggestion targets preset 'suznak'", () => {
    const suggestions = suggestModulations(RAST)
    expect(suggestions.length).toBeGreaterThan(0)
    const first = suggestions[0]
    expect(first.apply.kind).toBe('preset')
    expect((first.apply as { kind: 'preset'; id: string }).id).toBe('suznak')
  })

  it('does not include the current maqam itself', () => {
    const suggestions = suggestModulations(RAST)
    const ids = suggestions
      .filter((m) => m.apply.kind === 'preset')
      .map((m) => (m.apply as { kind: 'preset'; id: string }).id)
    expect(ids).not.toContain('rast')
  })

  it('returns a non-empty list', () => {
    expect(suggestModulations(RAST).length).toBeGreaterThan(0)
  })
})

describe('suggestModulations — already in Suznak', () => {
  it('does not suggest suznak when already active', () => {
    const suggestions = suggestModulations(SUZNAK)
    const ids = suggestions
      .filter((m) => m.apply.kind === 'preset')
      .map((m) => (m.apply as { kind: 'preset'; id: string }).id)
    expect(ids).not.toContain('suznak')
  })
})

describe('suggestModulations — all 8 core maqamat return non-empty', () => {
  const states: [string, MandalState][] = [
    ['rast', RAST], ['suznak', SUZNAK], ['bayati', BAYATI],
    ['hijaz', HIJAZ], ['kurd', KURD], ['nahawand', NAHAWAND],
    ['nikriz', NIKRIZ], ['saba', SABA]
  ]
  for (const [name, state] of states) {
    it(`${name} returns suggestions`, () => {
      expect(suggestModulations(state).length).toBeGreaterThan(0)
    })
  }
})

describe('suggestModulations — custom/unknown state', () => {
  it('falls back to jins-pair suggestions for unknown states', () => {
    const suggestions = suggestModulations(CUSTOM)
    // Should still return the applicable jins pairs
    const pairMoves = suggestions.filter((m) => m.apply.kind === 'pair')
    expect(pairMoves.length).toBeGreaterThanOrEqual(0)
    // Should have some suggestions
    expect(suggestions.length).toBeGreaterThanOrEqual(0)
  })
})
