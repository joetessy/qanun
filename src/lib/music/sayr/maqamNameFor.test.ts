import { describe, expect, it } from 'vitest'
import { maqamNameFor } from './maqamNameFor'

// [lower, upper, expected name]
type NameCase = readonly [string, string, string]

const expectNames = (cases: readonly NameCase[]): void => {
  for (const [lowerId, upperId, expected] of cases) expect(maqamNameFor({ lowerId, upperId })).toBe(expected)
}

describe('maqamNameFor', () => {
  it('names the catalogued pairings', () => {
    expectNames([
      ['rast', 'hijaz', 'Maqam Suznak'],
      ['rast', 'bayati', 'Maqam Nairuz'],
      ['rast', 'ajam', 'Maqam Mahur'],
      ['sikah', 'hijaz', 'Maqam Huzam'],
      ['bayati', 'hijaz', 'Maqam Bayati Shuri'],
      ['hijaz', 'nikriz', 'Maqam Hijazkar'],
      ['hijaz', 'ajam', 'Maqam Zanjaran'],
      ['kurd', 'nikriz', 'Maqam Hijazkar Kurd'],
      ['nahawand', 'bayati', 'Maqam ʿUshaq Masri'],
      ['nikriz', 'hijaz', 'Maqam Nawa Athar'],
      ['ajam', 'hijaz', 'Maqam Shawq Afza'],
      ['sikah', 'bayati', 'Maqam ʿIraq'],
      ['sikah', 'saba', 'Maqam Bastanikar']
    ])
  })
  it('a family’s common upper keeps the family name', () => {
    expectNames([
      ['bayati', 'rast', 'Maqam Bayati'],
      ['ajam', 'ajam', 'Maqam ʿAjam'],
      ['nahawand', 'kurd', 'Maqam Nahawand']
    ])
  })
  it('a free combination reads as the bare pairing, never as the family’s own maqam', () => {
    expectNames([
      ['rast', 'kurd', 'Rast ▸ Kurd'],
      ['saba', 'sikah', 'Saba ▸ Sikah'],
      ['nikriz', 'ajam', 'Nikriz ▸ ʿAjam']
    ])
  })
})
