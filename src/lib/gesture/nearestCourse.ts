// The play field spans nearly the full width now that the mandal is gone — a
// small left margin keeps the lowest course off the cabinet edge. x is a
// normalized screen coordinate (0 = screen-left), already mirrored by the caller.
export const PLAY_FIELD_LEFT = 0.04
export const PLAY_FIELD_RIGHT = 1.0

export interface NearestCourseArgs {
  x: number
  courseCount: number
  fieldLeft: number
  fieldRight: number
}

// Screen x of the centre of course `index`.
export const courseScreenX = (
  index: number,
  courseCount: number,
  fieldLeft: number,
  fieldRight: number
): number => {
  const cell = (fieldRight - fieldLeft) / courseCount
  return fieldLeft + (index + 0.5) * cell
}

// Nearest course to x (snap-to-nearest). Clamps to [0, courseCount-1].
export const nearestCourse = ({ x, courseCount, fieldLeft, fieldRight }: NearestCourseArgs): number => {
  const cell = (fieldRight - fieldLeft) / courseCount
  const raw = Math.floor((x - fieldLeft) / cell)
  return Math.min(courseCount - 1, Math.max(0, raw))
}

export interface CoursesCrossedArgs {
  prevX: number
  curX: number
  courseCount: number
  fieldLeft: number
  fieldRight: number
}

/**
 * Course indices whose CENTRE the finger swept past moving prevX → curX (a
 * strum). Returned in sweep order (low→high when moving right, reversed when
 * moving left). Because it keys on crossing a string's centre — not a course
 * boundary — sweeping back over the SAME string re-plays it, while a stationary
 * finger crosses nothing (the half-open interval avoids double-counting a centre
 * across consecutive frames).
 */
export const coursesCrossed = ({ prevX, curX, courseCount, fieldLeft, fieldRight }: CoursesCrossedArgs): number[] => {
  const lo = Math.min(prevX, curX)
  const hi = Math.max(prevX, curX)
  const crossed: number[] = []
  for (let i = 0; i < courseCount; i++) {
    const cx = courseScreenX(i, courseCount, fieldLeft, fieldRight)
    if (cx > lo && cx <= hi) crossed.push(i)
  }
  if (curX < prevX) crossed.reverse()
  return crossed
}
