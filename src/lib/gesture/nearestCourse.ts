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

// Default deadzone for hysteretic selection: the finger must travel this fraction
// of a cell PAST the boundary (i.e. into the neighbour) before the held string
// changes. Kills the boundary flicker that plain snap-to-nearest suffers on noisy
// hand-tracking input, without adding any smoothing lag.
export const COURSE_HYSTERESIS_MARGIN = 0.35

export interface CourseHysteresisArgs extends NearestCourseArgs {
  prevCourse: number | null // the course held last frame (null = nothing held yet)
  margin?: number
}

/**
 * Snap-to-nearest with hysteresis: keep `prevCourse` until the finger moves more
 * than (0.5 + margin) cells from that course's centre — i.e. more than `margin`
 * of a cell into a neighbour. A large jump (finger well past an adjacent string)
 * still snaps straight to the true nearest. A null or out-of-range `prevCourse`
 * (e.g. the field just shrank) degrades to plain nearestCourse.
 */
export const courseWithHysteresis = ({
  x,
  prevCourse,
  courseCount,
  fieldLeft,
  fieldRight,
  margin = COURSE_HYSTERESIS_MARGIN
}: CourseHysteresisArgs): number => {
  const nearest = nearestCourse({ x, courseCount, fieldLeft, fieldRight })
  if (prevCourse === null || prevCourse < 0 || prevCourse >= courseCount || nearest === prevCourse) {
    return nearest
  }
  const cell = (fieldRight - fieldLeft) / courseCount
  const prevCentre = courseScreenX(prevCourse, courseCount, fieldLeft, fieldRight)
  const offsetCells = Math.abs(x - prevCentre) / cell
  return offsetCells > 0.5 + margin ? nearest : prevCourse
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
