export const BPM_MIN = 30
export const BPM_MAX = 300

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value))

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

/**
 * Compute BPM from a list of tap timestamps (ms, e.g. `performance.now()`).
 * Uses the median of the **last 4 intervals** between consecutive taps,
 * dropping older taps and clamping the result to a sensible musical range.
 * Returns `null` if there are fewer than 2 taps (no interval to measure).
 */
export const tapTempoBpm = (tapsMs: readonly number[]): number | null => {
  if (tapsMs.length < 2) return null
  const intervals: number[] = []
  for (let i = 1; i < tapsMs.length; i += 1) {
    const dt = tapsMs[i] - tapsMs[i - 1]
    if (dt > 0) intervals.push(dt)
  }
  if (intervals.length === 0) return null
  const recent = intervals.slice(-4)
  const intervalMs = median(recent)
  const bpm = 60000 / intervalMs
  return clamp(bpm, BPM_MIN, BPM_MAX)
}
