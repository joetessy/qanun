import { describe, expect, it } from 'vitest'
import { LOWER_JINS, applyLowerJins, maqamNameFor, lowerJinsList } from './lowerJins'
import { jinsById } from '../ajnas/JINS'

describe('LOWER_JINS table', () => {
  it('lists the 9 families in key order with valid home degrees + 7-offset scales', () => {
    expect(lowerJinsList().map((j) => j.id)).toEqual(
      ['rast', 'bayati', 'hijaz', 'nahawand', 'kurd', 'nikriz', 'ajam', 'saba', 'sikah']
    )
    for (const j of LOWER_JINS) {
      expect([1, 2, 3]).toContain(j.homeDegree)
      expect(j.defaultScale).toHaveLength(7)
      expect(j.defaultScale[0]).toBe(0)
      expect(j.upperOptions.length).toBeGreaterThanOrEqual(1)
      for (const u of j.upperOptions) expect(() => jinsById(u)).not.toThrow()
    }
  })
  it('Bayati and Sikah keep the Rast collection (no note change), only the home moves', () => {
    const rast = LOWER_JINS.find((j) => j.id === 'rast')!
    const bayati = LOWER_JINS.find((j) => j.id === 'bayati')!
    const sikah = LOWER_JINS.find((j) => j.id === 'sikah')!
    expect(bayati.defaultScale).toEqual(rast.defaultScale)
    expect(sikah.defaultScale).toEqual(rast.defaultScale)
    expect(bayati.homeDegree).toBe(2)
    expect(sikah.homeDegree).toBe(3)
  })
  it('Hijaz roots on D (degree 2); Nahawand on C (degree 1, harmonic minor)', () => {
    expect(LOWER_JINS.find((j) => j.id === 'hijaz')!.homeDegree).toBe(2)
    expect(LOWER_JINS.find((j) => j.id === 'hijaz')!.defaultScale).toEqual([0, 2, 3, 6, 7, 9, 10.5])
    expect(LOWER_JINS.find((j) => j.id === 'nahawand')!.defaultScale).toEqual([0, 2, 3, 5, 7, 8, 11])
  })
  it('Rast does not offer ʿAjam as an upper', () => {
    expect(LOWER_JINS.find((j) => j.id === 'rast')!.upperOptions).not.toContain('ajam')
  })
})

describe('applyLowerJins', () => {
  it('loads the jins default scale + home degree', () => {
    const r = applyLowerJins('bayati')
    expect(r.mandalState).toEqual([0, 2, 3.5, 5, 7, 9, 10.5])
    expect(r.homeDegree).toBe(2)
  })
  it('returns a fresh array (not the table reference)', () => {
    expect(applyLowerJins('rast').mandalState).not.toBe(LOWER_JINS[0].defaultScale)
  })
})

describe('maqamNameFor', () => {
  it('special-cases the named maqamat, else "Maqam <lower>"', () => {
    expect(maqamNameFor('rast', 'hijaz')).toBe('Maqam Suznak')
    expect(maqamNameFor('rast', 'bayati')).toBe('Maqam Nairuz')
    expect(maqamNameFor('sikah', 'hijaz')).toBe('Maqam Huzam')
    expect(maqamNameFor('bayati', 'hijaz')).toBe('Maqam Bayati Shuri')
    expect(maqamNameFor('bayati', 'rast')).toBe('Maqam Bayati')
    expect(maqamNameFor('ajam', 'ajam')).toBe('Maqam ʿAjam')
  })
})
