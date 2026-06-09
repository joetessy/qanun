import { describe, expect, it } from 'vitest'
import { nearestCourse, coursesCrossed, courseScreenX, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from './nearestCourse'

const ARGS = { courseCount: 28, fieldLeft: PLAY_FIELD_LEFT, fieldRight: PLAY_FIELD_RIGHT }
const cx = (i: number) => courseScreenX(i, 28, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT)

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

describe('coursesCrossed (strum)', () => {
  it('returns nothing when the finger does not move', () => {
    expect(coursesCrossed({ prevX: cx(10), curX: cx(10), ...ARGS })).toEqual([])
  })

  it('returns the strings swept past, in left→right order moving right', () => {
    // From just left of string 5 to just right of string 8 → 5,6,7,8.
    const crossed = coursesCrossed({ prevX: cx(5) - 0.001, curX: cx(8) + 0.001, ...ARGS })
    expect(crossed).toEqual([5, 6, 7, 8])
  })

  it('returns strings in right→left order moving left', () => {
    const crossed = coursesCrossed({ prevX: cx(8) + 0.001, curX: cx(5) - 0.001, ...ARGS })
    expect(crossed).toEqual([8, 7, 6, 5])
  })

  it('re-plays the SAME string when swept back over it', () => {
    // Right across 10's centre, then back left across it — each pass counts once.
    const right = coursesCrossed({ prevX: cx(10) - 0.001, curX: cx(10) + 0.001, ...ARGS })
    const left = coursesCrossed({ prevX: cx(10) + 0.001, curX: cx(10) - 0.001, ...ARGS })
    expect(right).toEqual([10])
    expect(left).toEqual([10])
  })

  it('does not re-count a centre while the finger sits just past it (no machine-gun)', () => {
    // Arrive at 10's centre, then a tiny stationary jitter strictly past it.
    const arrive = coursesCrossed({ prevX: cx(10) - 0.002, curX: cx(10), ...ARGS })
    const sit = coursesCrossed({ prevX: cx(10), curX: cx(10) + 0.0005, ...ARGS })
    expect(arrive).toEqual([10])
    expect(sit).toEqual([])
  })
})
