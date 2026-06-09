import { describe, it, expect } from 'vitest'
import { reverbSizeToParams } from './reverbSize'
import type { ReverbSize } from '../../types'

describe('reverbSizeToParams', () => {
  it('maps each preset to a distinct, increasing decay', () => {
    const small = reverbSizeToParams('small')
    const medium = reverbSizeToParams('medium')
    const hall = reverbSizeToParams('hall')

    // Decays should be strictly increasing so the UI feels like "more space".
    expect(small.decaySec).toBeGreaterThan(0)
    expect(medium.decaySec).toBeGreaterThan(small.decaySec)
    expect(hall.decaySec).toBeGreaterThan(medium.decaySec)
  })

  it('uses a non-negative pre-delay for every preset', () => {
    const sizes: ReverbSize[] = ['small', 'medium', 'hall']
    for (const size of sizes) {
      const { preDelaySec } = reverbSizeToParams(size)
      expect(preDelaySec).toBeGreaterThanOrEqual(0)
    }
  })

  it('stays inside Tone.Reverb safe ranges (0.001s <= decay <= 60s)', () => {
    // Tone.Reverb throws on decay <= 0; values above ~60s eat memory on the
    // convolver buffer. Keep us comfortably inside that window.
    const sizes: ReverbSize[] = ['small', 'medium', 'hall']
    for (const size of sizes) {
      const { decaySec } = reverbSizeToParams(size)
      expect(decaySec).toBeGreaterThanOrEqual(0.001)
      expect(decaySec).toBeLessThanOrEqual(10)
    }
  })

  it('returns the same object shape for unknown values by falling back to medium', () => {
    // Defensive: callers should never pass invalid sizes, but if a stale
    // setting deserializes wrong we shouldn't crash the audio graph.
    // @ts-expect-error — intentionally invalid size to exercise the fallback.
    const fallback = reverbSizeToParams('jumbo')
    const medium = reverbSizeToParams('medium')
    expect(fallback).toEqual(medium)
  })
})
