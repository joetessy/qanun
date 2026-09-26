import { describe, expect, it } from 'vitest'
import { stringCount } from './stringCount'

describe('stringCount', () => {
  it('counts both ends of the window', () => {
    expect(stringCount({ low: -9, high: 15 })).toBe(25)
    expect(stringCount({ low: 3, high: 10 })).toBe(8)
  })
})
