import type { NormPoint } from '../../types'

export interface PinchDistanceArgs {
  a: NormPoint
  b: NormPoint
}

// Euclidean distance between two normalized landmarks (image-space units).
export const pinchDistance = ({ a, b }: PinchDistanceArgs): number =>
  Math.hypot(a.x - b.x, a.y - b.y)
