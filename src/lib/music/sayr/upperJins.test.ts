import { describe, expect, it } from 'vitest'
import { applyUpperJins, upperOptions, ghammazFieldDegree } from './upperJins'

describe('ghammazFieldDegree', () => {
  it('shifts the jins ghammāz by the home degree (all families land on G=deg5 except Saba)', () => {
    expect(ghammazFieldDegree('rast', 1)).toBe(5)   // home1 + 5 - 1
    expect(ghammazFieldDegree('bayati', 2)).toBe(5)  // home2 + 4 - 1
    expect(ghammazFieldDegree('sikah', 3)).toBe(5)   // home3 + 3 - 1
    expect(ghammazFieldDegree('saba', 2)).toBe(4)    // home2 + 3 - 1 (F)
  })
})

describe('applyUpperJins (home-aware)', () => {
  it('Bayati(home 2) + Nahawand re-tunes degrees 6–7 from the G ghammāz', () => {
    const bayati = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins(bayati, 'nahawand', 2, 'bayati')).toEqual([0, 2, 3.5, 5, 7, 9, 10])
  })
  it('Rast(home 1) + Hijaz → Suznak collection', () => {
    const rast = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins(rast, 'hijaz', 1, 'rast')).toEqual([0, 2, 3.5, 5, 7, 8, 11])
  })
  it('does not alter degrees at or below the ghammāz', () => {
    const bayati = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins(bayati, 'hijaz', 2, 'bayati').slice(0, 5)).toEqual(bayati.slice(0, 5))
  })
  it('Hijaz(home 2) + Hijazkar → Nikriz on the ghammāz + raised leading tone (C♯)', () => {
    const hijaz = [0, 2, 3, 6, 7, 9, 10.5]
    expect(applyUpperJins(hijaz, 'hijazkar', 2, 'hijaz')).toEqual([1, 2, 3, 6, 7, 9, 10])
  })
})

describe('upperOptions', () => {
  it('returns the lower jins upper list with the selected one flagged', () => {
    const opts = upperOptions('bayati', 'nahawand')
    expect(opts.map((o) => o.id)).toEqual(['nahawand', 'rast', 'hijaz'])
    expect(opts[0].label).toBe('Nahawand')
    expect(opts.find((o) => o.id === 'nahawand')!.active).toBe(true)
  })
  it('lights "Nikriz Hijazkar" on Hijaz when it is the selected upper', () => {
    const opts = upperOptions('hijaz', 'hijazkar')
    const hijazkar = opts.find((o) => o.id === 'hijazkar')!
    expect(hijazkar).toBeDefined()
    expect(hijazkar.label).toBe('Nikriz Hijazkar')
    expect(hijazkar.active).toBe(true)
  })
  it('does NOT also light Nahawand when Hijazkar is the selected upper (regression)', () => {
    const opts = upperOptions('hijaz', 'hijazkar')
    expect(opts.find((o) => o.id === 'nahawand')!.active).toBe(false)
  })
  it('defaults to Hijaz as the lit secondary jins for Saba (regression)', () => {
    // Saba's first upperOption is the default the engine selects; it must light.
    const opts = upperOptions('saba', 'hijaz')
    expect(opts[0].id).toBe('hijaz')
    expect(opts.find((o) => o.id === 'hijaz')!.active).toBe(true)
  })
})
