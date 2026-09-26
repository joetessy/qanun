import { describe, expect, it } from 'vitest'
import { jinsTuning } from './jinsTuning'
import { lowerJinsList } from './lowerJins'
import { upperJinsFamilies } from './upperJinsFamilies'

describe('jinsTuning', () => {
  it('rebuilds from the lower jins default, so an earlier upper leaves no trace', () => {
    // Hijazkar raises degree 1; switching the upper back to Rast must restore C.
    expect(jinsTuning({ lowerId: 'hijaz', upperId: 'nikriz' }).mandalState[0]).toBe(1)
    expect(jinsTuning({ lowerId: 'hijaz', upperId: 'rast' })).toEqual({ mandalState: [0, 2, 3, 6, 7, 9, 10.5], homeDegree: 2 })
  })
  it('the default upper reproduces each family’s default scale', () => {
    for (const lower of lowerJinsList()) {
      expect(jinsTuning({ lowerId: lower.id, upperId: lower.commonUppers[0] }).mandalState).toEqual([...lower.defaultScale])
    }
  })
  it('every pairing keeps the strings in pitch order within the octave', () => {
    for (const lower of lowerJinsList()) {
      for (const upper of upperJinsFamilies()) {
        const s = jinsTuning({ lowerId: lower.id, upperId: upper.id }).mandalState
        for (let d = 1; d < 7; d++) expect(s[d]).toBeGreaterThan(s[d - 1])
        expect(s[0] + 12).toBeGreaterThan(s[6]) // the next octave's degree 1 still sits above degree 7
      }
    }
  })
})
