import { describe, expect, it } from 'vitest'
import { nextVoiceIndex } from './voicePool'

describe('nextVoiceIndex — round-robin', () => {
  it('advances and wraps', () => {
    expect(nextVoiceIndex(0, 4)).toBe(1)
    expect(nextVoiceIndex(3, 4)).toBe(0)
  })
  it('handles a pool of one', () => {
    expect(nextVoiceIndex(0, 1)).toBe(0)
  })
})
