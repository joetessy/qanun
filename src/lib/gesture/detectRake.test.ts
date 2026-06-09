import { describe, expect, it } from 'vitest'
import { createRakeDetector } from './detectRake'

describe('createRakeDetector — cross-velocity glissando', () => {
  it('on a fast sweep, plucks every course crossed since the last frame', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    expect(r.update({ courseIndex: 2, tNow: 0 })).toEqual([])      // first frame primes
    const crossed = r.update({ courseIndex: 5, tNow: 0.05 })       // 3 courses in 50ms
    expect(crossed).toEqual([3, 4, 5])
  })

  it('emits leftward sweeps in crossing order', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    r.update({ courseIndex: 6, tNow: 0 })
    expect(r.update({ courseIndex: 3, tNow: 0.05 })).toEqual([5, 4, 3])
  })

  it('stays silent on slow repositioning (below the speed threshold)', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    r.update({ courseIndex: 2, tNow: 0 })
    expect(r.update({ courseIndex: 3, tNow: 1.0 })).toEqual([]) // 1 course / sec
  })

  it('off → never rakes', () => {
    const r = createRakeDetector({ sensitivity: 'off' })
    r.update({ courseIndex: 0, tNow: 0 })
    expect(r.update({ courseIndex: 20, tNow: 0.05 })).toEqual([])
  })

  it('subtle needs a faster sweep than full to trigger', () => {
    const make = (s: 'subtle' | 'full') => {
      const r = createRakeDetector({ sensitivity: s })
      r.update({ courseIndex: 0, tNow: 0 })
      return r.update({ courseIndex: 2, tNow: 0.2 }) // 10 courses/sec
    }
    expect(make('full').length).toBeGreaterThan(0)  // full triggers
    expect(make('subtle')).toEqual([])              // subtle does not
  })

  it('setSensitivity changes the threshold at runtime', () => {
    const r = createRakeDetector({ sensitivity: 'off' })
    r.update({ courseIndex: 0, tNow: 0 })
    r.setSensitivity('full')
    expect(r.update({ courseIndex: 3, tNow: 0.05 })).toEqual([1, 2, 3])
  })

  it('reset() re-primes — the next frame is treated as the first again', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    r.update({ courseIndex: 2, tNow: 0 })
    r.update({ courseIndex: 5, tNow: 0.05 }) // rakes
    r.reset()
    expect(r.update({ courseIndex: 0, tNow: 0.10 })).toEqual([]) // primes again, no rake
    expect(r.update({ courseIndex: 3, tNow: 0.15 })).toEqual([1, 2, 3]) // then normal
  })
})
