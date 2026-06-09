/** Normalize a pointer's clientX to [0, 1] within the play surface rect. */
export const stageNormalizedX = ({
  clientX,
  rectLeft,
  rectWidth
}: {
  clientX: number
  rectLeft: number
  rectWidth: number
}): number => Math.min(1, Math.max(0, (clientX - rectLeft) / rectWidth))

/**
 * Upper diatonic neighbor of a course.
 * The field is scale-locked, so courseIndex + 1 is always the upper diatonic
 * neighbor. Clamps at courseCount - 1 (can't go higher than the top string).
 */
export const upperNeighborCourse = (courseIndex: number, courseCount: number): number =>
  Math.min(courseIndex + 1, courseCount - 1)
