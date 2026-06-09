import { describe, expect, it } from 'vitest'
import { sanity } from './sanity'

describe('scaffold', () => {
  it('runs the test runner', () => {
    expect(sanity()).toBe(true)
  })
})
