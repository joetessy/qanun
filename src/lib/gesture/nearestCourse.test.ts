import { describe, expect, it } from 'vitest'
import { nearestCourse, coursesCrossed, courseWithHysteresis, courseScreenX, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from './nearestCourse'

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

describe('courseWithHysteresis', () => {
  // A simple 4-course field over [0,1]: cell 0.25, centres 0.125/0.375/0.625/0.875,
  // boundaries at 0.25/0.5/0.75. margin 0.35 → must move >0.85 cells from the held
  // course's centre (i.e. >0.35 into the neighbour) before the selection switches.
  const H = { courseCount: 4, fieldLeft: 0, fieldRight: 1, margin: 0.35 }

  it('falls back to plain nearest when there is no previous course', () => {
    expect(courseWithHysteresis({ x: 0.62, prevCourse: null, ...H })).toBe(2)
  })

  it('keeps the held course while the finger lingers just past the boundary', () => {
    // x = 0.55 is technically in course 2, but only 0.2 of a cell past course 1's
    // centre — inside the deadzone, so it stays on 1.
    expect(nearestCourse({ x: 0.55, courseCount: 4, fieldLeft: 0, fieldRight: 1 })).toBe(2)
    expect(courseWithHysteresis({ x: 0.55, prevCourse: 1, ...H })).toBe(1)
  })

  it('switches once the finger crosses far enough into the neighbour', () => {
    // x = 0.62 is 0.98 cells from course 1's centre — past the 0.85 threshold.
    expect(courseWithHysteresis({ x: 0.62, prevCourse: 1, ...H })).toBe(2)
  })

  it('snaps directly on a large jump (more than one course away)', () => {
    expect(courseWithHysteresis({ x: 0.9, prevCourse: 1, ...H })).toBe(3)
  })

  it('returns the held course unchanged when the finger has not left it', () => {
    expect(courseWithHysteresis({ x: 0.375, prevCourse: 1, ...H })).toBe(1)
  })

  it('ignores a stale previous course outside the current field', () => {
    // prevCourse 9 no longer exists (field shrank) → behave as plain nearest.
    expect(courseWithHysteresis({ x: 0.62, prevCourse: 9, ...H })).toBe(2)
  })
})
