import { describe, expect, it } from 'vitest'
import type { MandalState } from '../types'
import { applyUpperJins, currentUpperJins, upperOptions } from './upperJins'
import { identifyAjnas } from '../identifyAjnas'

// ── TDD vectors from spec §2 ─────────────────────────────────────────────────

describe('applyUpperJins — Rast root (ghammāz 5)', () => {
  const RAST: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]

  it('→ hijaz gives [0,2,3.5,5,7,8,11] = Suznak', () => {
    const result = applyUpperJins(RAST, 'hijaz')
    expect(result).toEqual([0, 2, 3.5, 5, 7, 8, 11])
    expect(identifyAjnas(result).maqamName).toBe('Maqam Suznak')
  })

  it('→ nahawand gives [0,2,3.5,5,7,9,10]', () => {
    const result = applyUpperJins(RAST, 'nahawand')
    expect(result).toEqual([0, 2, 3.5, 5, 7, 9, 10])
  })

  it('does not touch degrees 1..5 (root preserved)', () => {
    const result = applyUpperJins(RAST, 'hijaz')
    // Degrees 1–5 (indices 0–4) must equal original
    for (let i = 0; i < 5; i++) {
      expect(result[i]).toBe(RAST[i])
    }
  })

  it('returns a new array (immutable)', () => {
    const result = applyUpperJins(RAST, 'hijaz')
    expect(result).not.toBe(RAST)
    expect(RAST).toEqual([0, 2, 3.5, 5, 7, 9, 10.5]) // original untouched
  })
})

describe('applyUpperJins — Bayati root (ghammāz 4)', () => {
  // Bayati: [0, 1.5, 3, 5]  ghammāz=4  → gOffset = state[3] = 5
  const BAYATI: MandalState = [0, 1.5, 3, 5, 7, 8, 10]

  it('→ hijaz gives [0,1.5,3,5,6,9,10] with degree5=6', () => {
    const result = applyUpperJins(BAYATI, 'hijaz')
    expect(result).toEqual([0, 1.5, 3, 5, 6, 9, 10])
    expect(identifyAjnas(result).upper).toBe('hijaz')
  })
})

describe('applyUpperJins — Hijaz root (ghammāz 4)', () => {
  // Hijaz: [0, 1, 4, 5]  ghammāz=4  → gOffset = state[3] = 5
  const HIJAZ_STATE: MandalState = [0, 1, 4, 5, 7, 8, 10]

  it('→ rast gives [0,1,4,5,7,8.5,10] = Maqam Hijaz', () => {
    const result = applyUpperJins(HIJAZ_STATE, 'rast')
    expect(result).toEqual([0, 1, 4, 5, 7, 8.5, 10])
    expect(identifyAjnas(result).maqamName).toBe('Maqam Hijaz')
  })
})

describe('applyUpperJins — unknown/no root', () => {
  it('returns state unchanged when no lower jins is identified', () => {
    const WEIRD: MandalState = [0, 1.5, 4, 6, 7, 8.5, 11]
    expect(applyUpperJins(WEIRD, 'rast')).toEqual(WEIRD)
  })
})

// ── currentUpperJins ──────────────────────────────────────────────────────────

describe('currentUpperJins', () => {
  it('returns "rast" for the default Rast state', () => {
    const RAST: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(currentUpperJins(RAST)).toBe('rast')
  })

  it('returns "hijaz" after applying hijaz to Rast (= Suznak)', () => {
    const SUZNAK: MandalState = [0, 2, 3.5, 5, 7, 8, 11]
    expect(currentUpperJins(SUZNAK)).toBe('hijaz')
  })

  it('returns null for an unidentifiable state', () => {
    const WEIRD: MandalState = [0, 1.5, 4, 6, 7, 8.5, 11]
    expect(currentUpperJins(WEIRD)).toBeNull()
  })
})

// ── upperOptions ──────────────────────────────────────────────────────────────

describe('upperOptions', () => {
  it('returns options for Rast root with correct active flag', () => {
    const RAST: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]
    const opts = upperOptions(RAST)
    // Should include rast, nahawand, hijaz, bayati
    expect(opts.map((o) => o.id)).toEqual(['rast', 'nahawand', 'hijaz', 'bayati'])
    // 'rast' is the active upper for standard Rast
    expect(opts.find((o) => o.id === 'rast')?.active).toBe(true)
    expect(opts.find((o) => o.id === 'hijaz')?.active).toBe(false)
  })

  it('labels well-known maqamat without the "Maqam " prefix', () => {
    const RAST: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]
    const opts = upperOptions(RAST)
    // hijaz upper on rast = Suznak
    expect(opts.find((o) => o.id === 'hijaz')?.label).toBe('Suznak')
  })

  it('returns [] for an unidentifiable state', () => {
    const WEIRD: MandalState = [0, 1.5, 4, 6, 7, 8.5, 11]
    expect(upperOptions(WEIRD)).toEqual([])
  })

  it('marks the active option correctly after applying an upper', () => {
    const RAST: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]
    const SUZNAK = applyUpperJins(RAST, 'hijaz')
    const opts = upperOptions(SUZNAK)
    expect(opts.find((o) => o.id === 'hijaz')?.active).toBe(true)
    expect(opts.find((o) => o.id === 'rast')?.active).toBe(false)
  })

  it('returns options for Bayati root', () => {
    const BAYATI: MandalState = [0, 1.5, 3, 5, 7, 8, 10]
    const opts = upperOptions(BAYATI)
    expect(opts.map((o) => o.id)).toEqual(['nahawand', 'rast', 'hijaz'])
  })
})
