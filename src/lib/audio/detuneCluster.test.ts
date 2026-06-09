import { describe, expect, it } from 'vitest'
import { detunedFreqs } from './detuneCluster'

describe('detunedFreqs', () => {
  it('0 cents returns the exact input frequency', () => {
    expect(detunedFreqs(440, [0])[0]).toBe(440)
    expect(detunedFreqs(261.63, [0])[0]).toBe(261.63)
  })

  it('+4 cents is approx freqHz * 1.002312', () => {
    const result = detunedFreqs(440, [4])
    // 2**(4/1200) ≈ 1.002312
    expect(result[0]).toBeCloseTo(440 * Math.pow(2, 4 / 1200), 6)
  })

  it('-4 cents is approx freqHz * 0.997692', () => {
    const result = detunedFreqs(440, [-4])
    // 2**(-4/1200) ≈ 0.997692
    expect(result[0]).toBeCloseTo(440 * Math.pow(2, -4 / 1200), 6)
  })

  it('default cents [-4, 0, +4] returns 3 values symmetric around the original', () => {
    const freq = 330
    const [lo, mid, hi] = detunedFreqs(freq)
    expect(mid).toBe(freq) // 0 cents = exact
    // Symmetry is in log-ratio space (±4 cents): hi/freq ≈ freq/lo
    // In absolute Hz the +4 and -4 shifts differ slightly (log scale), so we
    // test within 1 Hz rather than demanding floating-point equality.
    expect(hi - freq).toBeCloseTo(freq - lo, 0)
    // Each detune step ≈ 0.231 % of freqHz (small, audible shimmer)
    expect(hi).toBeGreaterThan(freq)
    expect(lo).toBeLessThan(freq)
  })

  it('returns an array with the same length as cents', () => {
    expect(detunedFreqs(440, [-8, -4, 0, 4, 8])).toHaveLength(5)
    expect(detunedFreqs(440, [])).toHaveLength(0)
  })

  it('correctly computes known 12-TET interval: +1200 cents = one octave up', () => {
    const result = detunedFreqs(440, [1200])
    expect(result[0]).toBeCloseTo(880, 4)
  })

  it('correctly computes known 12-TET interval: -1200 cents = one octave down', () => {
    const result = detunedFreqs(440, [-1200])
    expect(result[0]).toBeCloseTo(220, 4)
  })

  it('default call produces 3 values (triple-course)', () => {
    expect(detunedFreqs(261.63)).toHaveLength(3)
  })
})
