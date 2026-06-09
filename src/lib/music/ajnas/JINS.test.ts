import { describe, expect, it } from 'vitest'
import { JINS, jinsById } from './JINS'

describe('JINS table', () => {
  it('includes the 9 family-head ajnas plus Hijazkar', () => {
    const ids = JINS.map((j) => j.id).sort()
    expect(ids).toEqual(
      ['ajam', 'bayati', 'hijaz', 'hijazkar', 'kurd', 'nahawand', 'nikriz', 'rast', 'saba', 'sikah'].sort()
    )
  })

  it('every jins starts on its tonic (interval 0) with strictly ascending intervals', () => {
    for (const j of JINS) {
      expect(j.intervals[0]).toBe(0)
      for (let i = 1; i < j.intervals.length; i++) {
        expect(j.intervals[i]).toBeGreaterThan(j.intervals[i - 1])
      }
    }
  })

  it('ghammazDegree is 3, 4, or 5 and indexes a real note in the jins', () => {
    for (const j of JINS) {
      expect([3, 4, 5]).toContain(j.ghammazDegree)
      expect(j.intervals.length).toBeGreaterThanOrEqual(j.ghammazDegree)
    }
  })

  it('transcribes the canonical interval vectors (docs/MUSIC-THEORY.md §3)', () => {
    expect(jinsById('rast').intervals).toEqual([0, 2, 3.5, 5, 7])
    expect(jinsById('nahawand').intervals).toEqual([0, 2, 3, 5, 7])
    expect(jinsById('ajam').intervals).toEqual([0, 2, 4, 5, 7])
    expect(jinsById('bayati').intervals).toEqual([0, 1.5, 3, 5])
    expect(jinsById('kurd').intervals).toEqual([0, 1, 3, 5])
    expect(jinsById('hijaz').intervals).toEqual([0, 1, 4, 5])
    expect(jinsById('saba').intervals).toEqual([0, 1.5, 3, 4])
    expect(jinsById('sikah').intervals).toEqual([0, 1.5, 3.5])
    expect(jinsById('nikriz').intervals).toEqual([0, 2, 3, 6, 7])
    expect(jinsById('hijazkar').intervals).toEqual([0, 1, 4, 5])
  })

  it('roots Sikah on the half-flat 3rd degree (homeDegree 3); others on 1', () => {
    expect(jinsById('sikah').homeDegree).toBe(3)
    expect(jinsById('rast').homeDegree).toBe(1)
    expect(jinsById('saba').homeDegree).toBe(1)
  })

  it('marks Saba as a trichord-ghammāz jins (ghammāz on 3)', () => {
    expect(jinsById('saba').ghammazDegree).toBe(3)
    expect(jinsById('sikah').ghammazDegree).toBe(3)
    expect(jinsById('bayati').ghammazDegree).toBe(4)
    expect(jinsById('rast').ghammazDegree).toBe(5)
  })

  it('jinsById throws on an unknown id', () => {
    expect(() => jinsById('nope')).toThrow()
  })

  it('declares hijaz before hijazkar (identifyAjnas tie-break relies on order)', () => {
    const ids = JINS.map((j) => j.id)
    expect(ids.indexOf('hijaz')).toBeLessThan(ids.indexOf('hijazkar'))
  })
})
