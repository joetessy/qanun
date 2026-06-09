import { describe, expect, it } from 'vitest'
import { formatCents } from './formatCents'

describe('formatCents', () => {
  it('renders zero with no sign and no cent glyph', () => {
    expect(formatCents(0)).toBe('0')
  })

  it('prefixes a positive offset with + and appends the cent glyph', () => {
    expect(formatCents(30)).toBe('+30¢')
    expect(formatCents(100)).toBe('+100¢')
  })

  it('prefixes a negative offset with a true minus sign', () => {
    expect(formatCents(-45)).toBe('−45¢')
    expect(formatCents(-100)).toBe('−100¢')
  })
})
