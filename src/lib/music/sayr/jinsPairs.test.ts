import { describe, expect, it } from 'vitest'
import {
  JINS_PAIRS,
  EXCLUDED_PAIRS,
  applyJinsPair,
  isPairActive
} from './jinsPairs'
import { DEFAULT_RAST_STATE, offsetOf, setMandal } from '../ajnas/MANDALS'
import type { MandalState } from '../types'

const BAYATI: MandalState = [0, 1.5, 3, 5, 7, 8, 10]

describe('JINS_PAIRS — the P1 single-mandal quick-swaps', () => {
  it('contains exactly Bayati↔Saba and Hijaz↔Hijazkar', () => {
    expect(JINS_PAIRS.map((p) => p.id).sort()).toEqual(['bayati-saba', 'hijaz-hijazkar'])
  })

  it('each pair flips exactly one degree between two legal positions', () => {
    for (const p of JINS_PAIRS) {
      expect([1, 2, 3, 4, 5, 6, 7]).toContain(p.degree)
      expect(p.offsetA).not.toBe(p.offsetB)
    }
  })

  it('Bayati↔Saba lowers the 4th degree (5 ↔ 4)', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect(pair.degree).toBe(4)
    expect([pair.offsetA, pair.offsetB].sort()).toEqual([4, 5])
  })

  it('Hijaz↔Hijazkar raises the leading tone, degree 7 (10 ↔ 11)', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'hijaz-hijazkar')!
    expect(pair.degree).toBe(7)
    expect([pair.offsetA, pair.offsetB].sort()).toEqual([10, 11])
  })

  it('deliberately EXCLUDES Nahawand↔Nikriz as a fluid pair', () => {
    expect(EXCLUDED_PAIRS).toContain('nahawand-nikriz')
    expect(JINS_PAIRS.map((p) => p.id)).not.toContain('nahawand-nikriz')
  })
})

describe('applyJinsPair — toggles the one mandal, bidirectionally', () => {
  it('Bayati → Saba lowers degree 4 to 4 and leaves the rest', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    const toSaba = applyJinsPair(BAYATI, pair)
    expect(offsetOf(toSaba, 4)).toBe(4)
    expect(toSaba.filter((_, i) => i !== 3)).toEqual(BAYATI.filter((_, i) => i !== 3))
  })

  it('round-trips (apply twice returns the original)', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect(applyJinsPair(applyJinsPair(BAYATI, pair), pair)).toEqual(BAYATI)
  })

  it('snaps to offsetA from an unrelated value', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'hijaz-hijazkar')!
    const odd = setMandal(DEFAULT_RAST_STATE, 7, 10.5) // neither 10 nor 11
    expect(offsetOf(applyJinsPair(odd, pair), 7)).toBe(pair.offsetA)
  })
})

describe('isPairActive', () => {
  it('is true when the degree sits on either pole of the pair', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect(isPairActive(BAYATI, pair)).toBe(true)              // degree 4 = 5
    expect(isPairActive(applyJinsPair(BAYATI, pair), pair)).toBe(true) // degree 4 = 4
  })
  it('is false when the degree sits at neither pole', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    const neutral = setMandal(DEFAULT_RAST_STATE, 4, 6) // degree 4 = 6, neither 4 nor 5
    expect(isPairActive(neutral, pair)).toBe(false)
  })
})

describe('jins-pair labels', () => {
  it('carries the human-readable poles for the UI', () => {
    const bayatiSaba = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect([bayatiSaba.fromLabel, bayatiSaba.toLabel]).toEqual(['Bayati', 'Saba'])
    const hijazHijazkar = JINS_PAIRS.find((p) => p.id === 'hijaz-hijazkar')!
    expect([hijazHijazkar.fromLabel, hijazHijazkar.toLabel]).toEqual(['Hijaz', 'Hijazkar'])
  })
})
