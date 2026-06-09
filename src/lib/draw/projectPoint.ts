import type { NormPoint } from '../../types'

export interface ProjectPointArgs {
  p: NormPoint
  width: number
  height: number
  mirror?: boolean
}

// Project a MediaPipe normalized [0,1] point into pixel space, optionally mirrored.
export const projectPoint = ({
  p,
  width,
  height,
  mirror = false
}: ProjectPointArgs): { x: number; y: number } => ({
  x: (mirror ? 1 - p.x : p.x) * width,
  y: p.y * height
})
