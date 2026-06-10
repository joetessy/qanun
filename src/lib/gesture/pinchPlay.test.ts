import { describe, expect, it } from 'vitest'
import { createPinchPlay } from './pinchPlay'

describe('createPinchPlay', () => {
  it('quick pluck: emits pluck on close edge, nothing on open', () => {
    const p = createPinchPlay()
    expect(p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })).toEqual([])
    const evClose = p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 })
    expect(evClose).toHaveLength(1)
    expect(evClose[0]).toMatchObject({ type: 'pluck', courseIndex: 3 })
    expect(p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0.10 })).toEqual([])
  })

  it('fires exactly once per close — held frames emit nothing until reopened', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    expect(p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.05 })).toHaveLength(1)
    // Still closed — no repeat plucks no matter how long it's held.
    expect(p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.30 })).toEqual([])
    expect(p.update({ pinchDist: 0.02, courseIndex: 1, tNow: 1.00 })).toEqual([])
    // Reopen past the hysteresis threshold, close again → a new pluck.
    p.update({ pinchDist: 0.12, courseIndex: 1, tNow: 1.10 })
    expect(p.update({ pinchDist: 0.02, courseIndex: 1, tNow: 1.20 })).toHaveLength(1)
  })

  it('hysteresis: a dist between close and open thresholds does not re-arm', () => {
    const p = createPinchPlay({ closeThreshold: 0.05, openThreshold: 0.07 })
    p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0 }) // close → pluck
    // Drift into the dead band (between thresholds) — still considered closed.
    expect(p.update({ pinchDist: 0.06, courseIndex: 0, tNow: 0.05 })).toEqual([])
    // Back below close — no new pluck (never re-armed).
    expect(p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.10 })).toEqual([])
  })

  it('reset() clears all state so a fresh close fires a new pluck', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 2, tNow: 0 })
    p.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.05 })
    p.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.10 })

    p.reset()

    p.update({ pinchDist: 0.12, courseIndex: 4, tNow: 0.15 }) // open (re-prime)
    const evts = p.update({ pinchDist: 0.02, courseIndex: 4, tNow: 0.20 })
    expect(evts).toHaveLength(1)
    expect(evts[0]).toMatchObject({ type: 'pluck', courseIndex: 4 })
  })

  it('derives velocity from close speed, clamped to [minVelocity, 1]', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    const ev = p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.05 })
    expect(ev[0].type).toBe('pluck')
    expect(ev[0].velocity).toBeGreaterThanOrEqual(0.4)
    expect(ev[0].velocity).toBeLessThanOrEqual(1)
  })

  it('cold-start fires pluck at minVelocity when no prior frame exists', () => {
    const p = createPinchPlay()
    const evts = p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0 })
    expect(evts).toHaveLength(1)
    expect(evts[0]).toMatchObject({ type: 'pluck', courseIndex: 0, velocity: 0.4 })
  })
})
