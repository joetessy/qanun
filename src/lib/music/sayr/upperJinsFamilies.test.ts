import { describe, expect, it } from 'vitest'
import { upperJinsFamilies } from './upperJinsFamilies'

describe('upperJinsFamilies', () => {
  it('is every family but Sikah, in the lower rail’s order', () => {
    expect(upperJinsFamilies().map((j) => j.id)).toEqual(
      ['rast', 'bayati', 'hijaz', 'nahawand', 'kurd', 'nikriz', 'ajam', 'saba']
    )
  })
})
