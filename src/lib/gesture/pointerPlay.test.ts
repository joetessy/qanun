import { describe, expect, it } from 'vitest'
import { stageNormalizedX, upperNeighborCourse } from './pointerPlay'

describe('stageNormalizedX', () => {
  it('returns 0 when clientX == rectLeft', () => {
    expect(stageNormalizedX({ clientX: 100, rectLeft: 100, rectWidth: 400 })).toBe(0)
  })

  it('returns 1 when clientX == rectLeft + rectWidth', () => {
    expect(stageNormalizedX({ clientX: 500, rectLeft: 100, rectWidth: 400 })).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(stageNormalizedX({ clientX: 300, rectLeft: 100, rectWidth: 400 })).toBeCloseTo(0.5)
  })

  it('clamps below 0', () => {
    expect(stageNormalizedX({ clientX: 50, rectLeft: 100, rectWidth: 400 })).toBe(0)
  })

  it('clamps above 1', () => {
    expect(stageNormalizedX({ clientX: 600, rectLeft: 100, rectWidth: 400 })).toBe(1)
  })
})

describe('upperNeighborCourse', () => {
  it('returns courseIndex + 1 for a mid-range course', () => {
    expect(upperNeighborCourse(10, 28)).toBe(11)
  })

  it('clamps at courseCount - 1 when already at the top', () => {
    expect(upperNeighborCourse(27, 28)).toBe(27)
  })

  it('returns 1 for course 0', () => {
    expect(upperNeighborCourse(0, 28)).toBe(1)
  })

  it('does not go below the clamped value regardless of large courseCount', () => {
    expect(upperNeighborCourse(99, 28)).toBe(27)
  })
})
