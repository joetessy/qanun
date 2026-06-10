import { describe, expect, it } from 'vitest'
import { stageNormalizedY } from './pointerPlay'

describe('stageNormalizedY', () => {
  it('returns 0 when clientY == rectTop', () => {
    expect(stageNormalizedY({ clientY: 100, rectTop: 100, rectHeight: 400 })).toBe(0)
  })

  it('returns 1 when clientY == rectTop + rectHeight', () => {
    expect(stageNormalizedY({ clientY: 500, rectTop: 100, rectHeight: 400 })).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(stageNormalizedY({ clientY: 300, rectTop: 100, rectHeight: 400 })).toBeCloseTo(0.5)
  })

  it('clamps below 0', () => {
    expect(stageNormalizedY({ clientY: 50, rectTop: 100, rectHeight: 400 })).toBe(0)
  })

  it('clamps above 1', () => {
    expect(stageNormalizedY({ clientY: 600, rectTop: 100, rectHeight: 400 })).toBe(1)
  })
})
