import { describe, expect, it } from 'vitest'
import { tapTempoBpm } from './tapTempo'

describe('tapTempoBpm', () => {
  it('returns null with fewer than two taps', () => {
    expect(tapTempoBpm([])).toBe(null)
    expect(tapTempoBpm([1000])).toBe(null)
  })

  it('computes BPM from the median interval of the last 4 taps', () => {
    // Spec example: taps at 0, 500, 1002, 1500, 2500 ms.
    // Intervals between consecutive taps: 500, 502, 498, 1000.
    // Last 4 intervals → [500, 502, 498, 1000]. Median = (500+502)/2 = 501.
    // 60000 / 501 ≈ 119.76 BPM. Spec asks for ~120.
    const taps = [0, 500, 1002, 1500, 2500]
    const bpm = tapTempoBpm(taps)
    expect(bpm).not.toBeNull()
    expect(bpm!).toBeGreaterThan(119)
    expect(bpm!).toBeLessThan(121)
  })

  it('uses only the last 4 intervals when more taps are provided', () => {
    // 10 taps, all 500ms apart → 120 BPM exactly.
    const taps = Array.from({ length: 10 }, (_, i) => i * 500)
    expect(tapTempoBpm(taps)).toBeCloseTo(120, 5)
  })

  it('rejects pathological intervals (clamps to [BPM_MIN, BPM_MAX])', () => {
    // 50ms interval would be 1200 BPM; clamp to 300.
    expect(tapTempoBpm([0, 50])).toBe(300)
    // 5s interval would be 12 BPM; clamp to 30.
    expect(tapTempoBpm([0, 5000])).toBe(30)
  })
})
