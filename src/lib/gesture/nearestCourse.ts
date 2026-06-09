// The play field occupies the screen to the right of the mandal zone
// (left ~18%). x is a normalized screen coordinate (0 = screen-left), already
// mirrored by the caller. Courses are uniform, cell-centred cells.
export const PLAY_FIELD_LEFT = 0.2
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
