import { describe, expect, it } from 'vitest'
import { createVibrato } from './vibrato'

const feedSine = (
  v: ReturnType<typeof createVibrato>,
  { amp, freq, secs, dt }: { amp: number; freq: number; secs: number; dt: number }
) => {
  let last = { cents: 0, rateHz: 0 }
  for (let t = 0; t <= secs; t += dt) {
    last = v.update({ y: 0.5 + amp * Math.sin(2 * Math.PI * freq * t), tNow: t, active: true })
  }
  return last
}

describe('createVibrato', () => {
  it('flat y while active → ~no vibrato', () => {
    const v = createVibrato()
    let r = { cents: 0, rateHz: 0 }
    for (let t = 0; t <= 0.3; t += 1 / 60) r = v.update({ y: 0.5, tNow: t, active: true })
    expect(r.cents).toBeLessThan(2)
  })
  it('vertical oscillation → vibrato depth + rate near the wobble frequency', () => {
    const r = feedSine(createVibrato(), { amp: 0.03, freq: 6, secs: 0.4, dt: 1 / 60 })
    expect(r.cents).toBeGreaterThan(8)
    expect(r.rateHz).toBeGreaterThan(4)
    expect(r.rateHz).toBeLessThan(8)
  })
  it('slow drift (2 Hz, below the wave-rate floor) → no vibrato even at full amplitude', () => {
    // A gentle 2 Hz vertical sway should NOT register as an intentional wave,
    // regardless of how large the excursion is.
    const slow = feedSine(createVibrato(), { amp: 0.06, freq: 2, secs: 0.4, dt: 1 / 60 })
    expect(slow.cents).toBe(0)
    expect(slow.rateHz).toBe(0)
    // Sanity: the deliberate 6 Hz wave with the same amplitude still registers.
    const fast = feedSine(createVibrato(), { amp: 0.06, freq: 6, secs: 0.4, dt: 1 / 60 })
    expect(fast.cents).toBeGreaterThan(0)
  })
  it('bigger wobble → more cents (clamped)', () => {
    const small = feedSine(createVibrato(), { amp: 0.01, freq: 6, secs: 0.4, dt: 1 / 60 })
    const big = feedSine(createVibrato(), { amp: 0.06, freq: 6, secs: 0.4, dt: 1 / 60 })
    expect(big.cents).toBeGreaterThan(small.cents)
    expect(big.cents).toBeLessThanOrEqual(70)
  })
  it('inactive → zero regardless of motion', () => {
    const v = createVibrato()
    const r = v.update({ y: 0.9, tNow: 0.1, active: false })
    expect(r).toEqual({ cents: 0, rateHz: 0 })
  })
})
