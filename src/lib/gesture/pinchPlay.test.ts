import { describe, expect, it } from 'vitest'
import { createPinchPlay } from './pinchPlay'

describe('createPinchPlay', () => {
  // TDD vector 1: quick pluck — no release emitted if never sustained
  it('quick pluck: emits pluck on close edge, nothing on open (never sustained)', () => {
    const p = createPinchPlay()
    expect(p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })).toEqual([])
    const evClose = p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 })
    expect(evClose).toHaveLength(1)
    expect(evClose[0]).toMatchObject({ type: 'pluck', courseIndex: 3 })
    // Open without sustain — no release
    expect(p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0.10 })).toEqual([])
  })

  // TDD vector 2: sustain path — pluck → wait → sustain → open → release
  it('sustain: emits pluck, then sustain after holdDelaySec, then release on open', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })
    const pluckEvts = p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 })
    expect(pluckEvts).toHaveLength(1)
    expect(pluckEvts[0].type).toBe('pluck')

    // Hold still past holdDelaySec (default 0.18)
    const sustainEvts = p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.30 })
    expect(sustainEvts).toHaveLength(1)
    expect(sustainEvts[0]).toMatchObject({ type: 'sustain', courseIndex: 3 })

    // Sustain doesn't re-fire while still held
    expect(p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.40 })).toEqual([])

    // Release on open
    const releaseEvts = p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0.50 })
    expect(releaseEvts).toHaveLength(1)
    expect(releaseEvts[0].type).toBe('release')
  })

  // TDD vector 3: glide — moving across courses while held; never triggers sustain
  it('glide: emits glide events for each new course; never sustains while moving', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })
    // Pluck on close
    p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 })

    // Move to course 5 (before holdDelaySec)
    const g1 = p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.10 })
    expect(g1).toHaveLength(1)
    expect(g1[0]).toMatchObject({ type: 'glide', courseIndex: 5 })

    // Move to course 6
    const g2 = p.update({ pinchDist: 0.02, courseIndex: 6, tNow: 0.15 })
    expect(g2).toHaveLength(1)
    expect(g2[0]).toMatchObject({ type: 'glide', courseIndex: 6 })
  })

  // TDD vector 4: move-while-sustaining — release + glide emitted together
  it('move-while-sustaining: release + glide emitted when moving after sustain started', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })
    p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 }) // pluck
    p.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.30 }) // sustain

    // Move while sustaining
    const evts = p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.35 })
    expect(evts).toHaveLength(2)
    expect(evts[0]).toMatchObject({ type: 'release' })
    expect(evts[1]).toMatchObject({ type: 'glide', courseIndex: 5 })
  })

  // TDD vector 5: reset() clears state; a fresh close fires a pluck again
  it('reset() clears all state so a fresh close fires a new pluck', () => {
    const p = createPinchPlay()
    // Initial open → close sequence
    p.update({ pinchDist: 0.12, courseIndex: 2, tNow: 0 })
    p.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.05 })
    // Stay closed
    p.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.10 })

    p.reset()

    // After reset, another close should fire a pluck
    p.update({ pinchDist: 0.12, courseIndex: 4, tNow: 0.15 }) // open (re-prime)
    const evts = p.update({ pinchDist: 0.02, courseIndex: 4, tNow: 0.20 })
    expect(evts).toHaveLength(1)
    expect(evts[0]).toMatchObject({ type: 'pluck', courseIndex: 4 })
  })

  // Additional: velocity is derived from close speed
  it('derives velocity from close speed, clamped to [minVelocity, 1]', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    const ev = p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.05 })
    expect(ev[0].type).toBe('pluck')
    if (ev[0].type === 'pluck') {
      expect(ev[0].velocity).toBeGreaterThanOrEqual(0.4)
      expect(ev[0].velocity).toBeLessThanOrEqual(1)
    }
  })

  // Additional: sustain fires exactly once
  it('sustain fires exactly once, not on subsequent held frames', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.05 }) // pluck
    p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.30 }) // sustain fires
    // Still held — no second sustain
    expect(p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.50 })).toEqual([])
    expect(p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 1.00 })).toEqual([])
  })

  // Additional: cold-start (already closed, no prior open frame) emits at minVelocity
  it('cold-start fires pluck at minVelocity when no prior frame exists', () => {
    const p = createPinchPlay()
    const evts = p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0 })
    expect(evts).toHaveLength(1)
    expect(evts[0]).toMatchObject({ type: 'pluck', courseIndex: 0, velocity: 0.4 })
  })

  // Course-lock (glideDebounceSec): a transient lateral blip during sustain
  // should NOT switch strings — only a course change that persists glides.
  it('while sustaining, a 1-frame course blip that snaps back does NOT glide', () => {
    const p = createPinchPlay({ holdDelaySec: 0.05, glideDebounceSec: 0.06 })
    p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0 })       // pluck (close)
    p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.1 })     // sustain
    const blip = p.update({ pinchDist: 0.02, courseIndex: 6, tNow: 0.11 }) // brief drift
    const back = p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.12 }) // snap back
    expect(blip.some((e) => e.type === 'glide')).toBe(false)
    expect(back.some((e) => e.type === 'glide')).toBe(false)
  })

  it('while sustaining, a course change that persists past the debounce DOES glide', () => {
    const p = createPinchPlay({ holdDelaySec: 0.05, glideDebounceSec: 0.06 })
    p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0 })
    p.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.1 })
    p.update({ pinchDist: 0.02, courseIndex: 6, tNow: 0.11 })   // drift starts
    const glided = p.update({ pinchDist: 0.02, courseIndex: 6, tNow: 0.2 }) // persisted
    expect(glided.some((e) => e.type === 'glide' && e.courseIndex === 6)).toBe(true)
  })

  // closed/sustaining expose the live state so the UI ring can mirror exactly
  // what the audio path is doing (no "shown pressed but silent" dead zone).
  it('exposes closed/sustaining state that tracks the pinch lifecycle', () => {
    const p = createPinchPlay()
    expect(p.closed).toBe(false)
    expect(p.sustaining).toBe(false)

    p.update({ pinchDist: 0.12, courseIndex: 2, tNow: 0 })       // open
    expect(p.closed).toBe(false)

    p.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.05 })    // close → pluck
    expect(p.closed).toBe(true)
    expect(p.sustaining).toBe(false)

    p.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.30 })    // held → sustain
    expect(p.closed).toBe(true)
    expect(p.sustaining).toBe(true)

    p.update({ pinchDist: 0.12, courseIndex: 2, tNow: 0.40 })    // open → release
    expect(p.closed).toBe(false)
    expect(p.sustaining).toBe(false)
  })

  it('reset() clears closed/sustaining', () => {
    const p = createPinchPlay()
    p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0 })    // close
    p.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.30 }) // sustain
    expect(p.closed).toBe(true)
    expect(p.sustaining).toBe(true)
    p.reset()
    expect(p.closed).toBe(false)
    expect(p.sustaining).toBe(false)
  })
})
