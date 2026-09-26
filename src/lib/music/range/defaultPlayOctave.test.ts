import { describe, expect, it } from 'vitest'
import { defaultPlayOctave } from './defaultPlayOctave'
import { DEFAULT_FIELD_RANGE } from './FIELD_RANGE'

const KEYS = 11

describe('defaultPlayOctave', () => {
  it('starts on the tonic when the window holds a full run of keys from it', () => {
    expect(defaultPlayOctave({ range: DEFAULT_FIELD_RANGE, keyCount: KEYS })).toBe(0)
    expect(defaultPlayOctave({ range: { low: 1, high: 8 }, keyCount: KEYS })).toBe(0) // D4–D5: S…L cover it
  })
  it('moves up to where the keys land for a window far above the tonic', () => {
    expect(defaultPlayOctave({ range: { low: 8, high: 15 }, keyCount: KEYS })).toBe(1)
  })
  it('moves down for a window under the tonic', () => {
    expect(defaultPlayOctave({ range: { low: -14, high: -7 }, keyCount: KEYS })).toBe(-2)
  })
})
