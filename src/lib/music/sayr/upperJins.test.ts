import { describe, expect, it } from 'vitest'
import { applyUpperJins, upperOptions, ghammazFieldDegree } from './upperJins'
import { lowerJinsList } from './lowerJins'
import { upperJinsFamilies } from './upperJinsFamilies'

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
    const state = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins({ state, upperId: 'nahawand', homeDegree: 2, lowerId: 'bayati' })).toEqual([0, 2, 3.5, 5, 7, 9, 10])
  })
  it('Rast(home 1) + Hijaz → Suznak collection', () => {
    const state = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins({ state, upperId: 'hijaz', homeDegree: 1, lowerId: 'rast' })).toEqual([0, 2, 3.5, 5, 7, 8, 11])
  })
  it('does not alter degrees at or below the ghammāz', () => {
    const state = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins({ state, upperId: 'hijaz', homeDegree: 2, lowerId: 'bayati' }).slice(0, 5)).toEqual(state.slice(0, 5))
  })
  it('Hijaz(home 2) + Nikriz → Hijazkar: the raised 4th wraps to the leading tone (C♯)', () => {
    // G A B♭ C♯ — the C♯ is octave-global (every degree-1 string), below the
    // home as well as above: classical Hijazkar descends D → C♯, not D → C.
    const state = [0, 2, 3, 6, 7, 9, 10.5]
    expect(applyUpperJins({ state, upperId: 'nikriz', homeDegree: 2, lowerId: 'hijaz' })).toEqual([1, 2, 3, 6, 7, 9, 10])
  })
  it('never wraps onto the lower jins itself — over a C-rooted Rast the home stays C', () => {
    // Nikriz on G would reach C♯ at the octave, but that string IS Rast's home.
    const state = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins({ state, upperId: 'nikriz', homeDegree: 1, lowerId: 'rast' })).toEqual([0, 2, 3.5, 5, 7, 9, 10])
  })
  it('Saba as an upper over Bayati wraps its diminished 4th (C♭) under the home', () => {
    const state = [0, 2, 3.5, 5, 7, 9, 10]
    expect(applyUpperJins({ state, upperId: 'saba', homeDegree: 2, lowerId: 'bayati' })).toEqual([-1, 2, 3.5, 5, 7, 8.5, 10])
  })
})

describe('upperOptions', () => {
  it('offers every family but Sikah as an upper on any lower, in the lower rail’s order', () => {
    const uppers = upperJinsFamilies().map((j) => j.id)
    for (const { id: lowerId } of lowerJinsList()) {
      const offered = upperOptions({ lowerId, currentUpperId: 'rast' }).map((o) => o.id)
      expect(offered).toEqual(uppers)
      expect(offered).not.toContain('sikah')
    }
  })
  it('flags the selected upper and names what each pairing spells', () => {
    const opts = upperOptions({ lowerId: 'rast', currentUpperId: 'hijaz' })
    const hijaz = opts.find((o) => o.id === 'hijaz')!
    expect(hijaz.active).toBe(true)
    expect(hijaz.label).toBe('Hijaz')
    expect(hijaz.maqamName).toBe('Maqam Suznak')
    expect(hijaz.named).toBe(true)
    expect(opts.filter((o) => o.active)).toHaveLength(1)
  })
  it('marks a free combination as unnamed', () => {
    const kurd = upperOptions({ lowerId: 'rast', currentUpperId: 'rast' }).find((o) => o.id === 'kurd')!
    expect(kurd.named).toBe(false)
    expect(kurd.maqamName).toBe('Rast ▸ Kurd')
  })
  it('lights Nikriz (Hijazkar) alone on Hijaz — no spurious Nahawand match', () => {
    const opts = upperOptions({ lowerId: 'hijaz', currentUpperId: 'nikriz' })
    expect(opts.find((o) => o.id === 'nikriz')!.maqamName).toBe('Maqam Hijazkar')
    expect(opts.filter((o) => o.active).map((o) => o.id)).toEqual(['nikriz'])
  })
})
