import { describe, expect, it } from 'vitest'
import { resolveActiveFinger } from './activeFinger'

const CLOSE = 0.3
const OPEN = 0.45
const resolve = (indexRatio: number, middleRatio: number, prev: 'none' | 'index' | 'middle' = 'none') =>
  resolveActiveFinger({ indexRatio, middleRatio, prev, closeRatio: CLOSE, openRatio: OPEN })

describe('resolveActiveFinger', () => {
  it('is none when both fingers are open', () => {
    expect(resolve(0.8, 0.9)).toBe('none')
  })

  it('engages index when only the index pinches', () => {
    expect(resolve(0.2, 0.8)).toBe('index')
  })

  it('engages middle when only the middle pinches', () => {
    expect(resolve(0.8, 0.2)).toBe('middle')
  })

  it('middle wins when both are pinched (tremolo takes precedence)', () => {
    expect(resolve(0.2, 0.18)).toBe('middle')
    // ...but a clearly closer index still wins.
    expect(resolve(0.1, 0.28)).toBe('index')
  })

  it('stays in index until it relaxes past openRatio (sticky, no mid-gesture flip)', () => {
    // Held index; middle dips toward a pinch but index has not released → stays index.
    expect(resolve(0.35, 0.2, 'index')).toBe('index') // index between close/open, still held
    // Index releases past open → middle (already pinched) takes over.
    expect(resolve(0.5, 0.2, 'index')).toBe('middle')
  })

  it('stays in middle until it relaxes past openRatio', () => {
    expect(resolve(0.2, 0.4, 'middle')).toBe('middle') // middle between close/open, still held
    expect(resolve(0.2, 0.6, 'middle')).toBe('index')  // middle released → index (pinched) takes over
  })

  it('a released finger falls back to none when nothing else is pinched', () => {
    expect(resolve(0.6, 0.7, 'middle')).toBe('none')
    expect(resolve(0.6, 0.7, 'index')).toBe('none')
  })
})
