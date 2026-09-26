import { describe, expect, it } from 'vitest'
import { playOctaveBounds } from './playOctaveBounds'
import { stringCount } from './stringCount'
import { DEFAULT_FIELD_RANGE, FIELD_RANGE_MAX, FIELD_RANGE_MIN, MIN_STRINGS } from './FIELD_RANGE'

const KEYS = 11 // A S D F G H J K L ; '

// Every window the slider allows.
const allWindows = (): { low: number; high: number }[] => {
  const windows: { low: number; high: number }[] = []
  for (let low = FIELD_RANGE_MIN; low <= FIELD_RANGE_MAX - (MIN_STRINGS - 1); low++) {
    for (let high = low + MIN_STRINGS - 1; high <= FIELD_RANGE_MAX; high++) windows.push({ low, high })
  }
  return windows
}

describe('playOctaveBounds', () => {
  it('reaches the strings under the tonic (default window: G3, A3 and B3 via octave −1)', () => {
    expect(playOctaveBounds({ range: DEFAULT_FIELD_RANGE, keyCount: KEYS })).toEqual({ min: -1, max: 2 })
  })
  it('covers a window that starts between tonics (D4–D5 over a C tonic)', () => {
    expect(playOctaveBounds({ range: { low: 1, high: 8 }, keyCount: KEYS })).toEqual({ min: -1, max: 1 })
  })
  it('makes every string of every legal window playable from some octave', () => {
    const windows = allWindows()
    expect(windows).toHaveLength(171)
    for (const range of windows) {
      const { min, max } = playOctaveBounds({ range, keyCount: KEYS })
      expect(min).toBeLessThanOrEqual(max)
      const reached = new Set<number>()
      for (let octave = min; octave <= max; octave++) {
        const first = -range.low + octave * 7
        let onString = 0
        for (let k = 0; k < KEYS; k++) {
          const index = first + k
          if (index >= 0 && index < stringCount(range)) { reached.add(index); onString++ }
        }
        expect(onString).toBeGreaterThan(0) // no octave is entirely silent
      }
      expect(reached.size).toBe(stringCount(range))
    }
  })
})
