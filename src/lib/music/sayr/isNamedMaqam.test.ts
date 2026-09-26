import { describe, expect, it } from 'vitest'
import { isNamedMaqam } from './isNamedMaqam'
import { maqamNameFor } from './maqamNameFor'
import { lowerJinsList } from './lowerJins'
import { upperJinsFamilies } from './upperJinsFamilies'

describe('isNamedMaqam', () => {
  it('flags named pairings and a family’s common uppers, not free combinations', () => {
    expect(isNamedMaqam({ lowerId: 'rast', upperId: 'ajam' })).toBe(true)  // Mahur
    expect(isNamedMaqam({ lowerId: 'rast', upperId: 'rast' })).toBe(true)  // Rast's own
    expect(isNamedMaqam({ lowerId: 'rast', upperId: 'kurd' })).toBe(false)
  })
  it('agrees with maqamNameFor for all 72 pairings (9 lowers × 8 uppers)', () => {
    for (const lower of lowerJinsList()) {
      for (const upper of upperJinsFamilies()) {
        const pair = { lowerId: lower.id, upperId: upper.id }
        expect(isNamedMaqam(pair)).toBe(maqamNameFor(pair).startsWith('Maqam '))
      }
    }
  })
})
