import { describe, expect, it } from 'vitest'
import { nearestCourse, courseScreenX, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from './nearestCourse'

const ARGS = { courseCount: 28, fieldLeft: PLAY_FIELD_LEFT, fieldRight: PLAY_FIELD_RIGHT }

describe('nearestCourse', () => {
  it('snaps the centre of a cell to that course (round-trip with courseScreenX)', () => {
    for (const i of [0, 1, 13, 27]) {
      const x = courseScreenX(i, ARGS.courseCount, ARGS.fieldLeft, ARGS.fieldRight)
      expect(nearestCourse({ x, ...ARGS })).toBe(i)
    }
  })

  it('is forgiving — a point anywhere inside a cell snaps to that course', () => {
    const w = (PLAY_FIELD_RIGHT - PLAY_FIELD_LEFT) / 28
    const centre = courseScreenX(10, 28, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT)
    expect(nearestCourse({ x: centre + w * 0.4, ...ARGS })).toBe(10)
    expect(nearestCourse({ x: centre - w * 0.4, ...ARGS })).toBe(10)
  })

  it('clamps below the field to course 0 and above to the last course', () => {
    expect(nearestCourse({ x: -1, ...ARGS })).toBe(0)
    expect(nearestCourse({ x: 0.05, ...ARGS })).toBe(0)  // near the left edge → first course
    expect(nearestCourse({ x: 2, ...ARGS })).toBe(27)
  })

  it('spans nearly the full width — small left margin, no mandal zone', () => {
    expect(PLAY_FIELD_LEFT).toBeLessThan(0.1)
    expect(PLAY_FIELD_RIGHT).toBe(1.0)
  })
})
