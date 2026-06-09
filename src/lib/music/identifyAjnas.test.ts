import { describe, expect, it } from 'vitest'
import { identifyAjnas } from './identifyAjnas'
import type { MandalState } from './types'

// Canonical mandal states for the core maqamat (degree 1..7 offsets).
const RAST: MandalState    = [0, 2, 3.5, 5, 7, 9, 10.5]
const SUZNAK: MandalState  = [0, 2, 3.5, 5, 7, 8, 11]   // Rast + Hijaz on 5
const NAHAWAND: MandalState = [0, 2, 3, 5, 7, 8, 10]    // Nahawand + Kurd on 5
const BAYATI: MandalState  = [0, 1.5, 3, 5, 7, 8, 10]   // Bayati + Nahawand on 4
const HIJAZ: MandalState   = [0, 1, 4, 5, 7, 8, 10]     // Hijaz + Nahawand on 4
const KURD: MandalState    = [0, 1, 3, 5, 7, 8, 10]     // Kurd + Nahawand on 4
const NIKRIZ: MandalState  = [0, 2, 3, 6, 7, 9, 10]     // Nikriz + Nahawand on 5
const SABA: MandalState    = [0, 1.5, 3, 4, 7, 8, 11]   // Saba + Hijaz on 3

describe('identifyAjnas — round-trips the core maqamat', () => {
  it('names Maqam Rast', () => {
    const id = identifyAjnas(RAST)
    expect(id.lower).toBe('rast')
    expect(id.maqamName).toBe('Maqam Rast')
  })
  it('names Maqam Suznak (Rast + Hijaz on 5)', () => {
    const id = identifyAjnas(SUZNAK)
    expect(id.lower).toBe('rast')
    expect(id.upper).toBe('hijaz')
    expect(id.maqamName).toBe('Maqam Suznak')
  })
  it('names Maqam Nahawand', () => {
    expect(identifyAjnas(NAHAWAND).maqamName).toBe('Maqam Nahawand')
  })
  it('names Maqam Bayati', () => {
    const id = identifyAjnas(BAYATI)
    expect(id.lower).toBe('bayati')
    expect(id.maqamName).toBe('Maqam Bayati')
  })
  it('names Maqam Hijaz', () => {
    expect(identifyAjnas(HIJAZ).maqamName).toBe('Maqam Hijaz')
  })
  it('names Maqam Kurd (distinct from Hijaz by the 3rd)', () => {
    const id = identifyAjnas(KURD)
    expect(id.lower).toBe('kurd')
    expect(id.maqamName).toBe('Maqam Kurd')
  })
  it('names Maqam Nikriz', () => {
    expect(identifyAjnas(NIKRIZ).maqamName).toBe('Maqam Nikriz')
  })
  it('names Maqam Saba (ghammāz on 3, upper Hijaz)', () => {
    const id = identifyAjnas(SABA)
    expect(id.lower).toBe('saba')
    expect(id.upper).toBe('hijaz')
    expect(id.maqamName).toBe('Maqam Saba')
  })
})

describe('identifyAjnas — fallbacks', () => {
  it('reports the ajnas pair when there is no named maqam', () => {
    // Rast lower with a Kurd-shaped upper on 5 is not a catalogued P1 maqam.
    const RAST_KURD: MandalState = [0, 2, 3.5, 5, 7, 8, 10]
    const id = identifyAjnas(RAST_KURD)
    expect(id.lower).toBe('rast')
    expect(id.upper).toBe('kurd')
    expect(id.maqamName).toBe('Rast ▸ Kurd')
  })
  it('reports "custom" when the lower degrees match no jins', () => {
    const WEIRD: MandalState = [0, 1.5, 4, 6, 7, 8.5, 11]
    expect(identifyAjnas(WEIRD).maqamName).toBe('custom')
  })
})
