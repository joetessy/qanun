import type { NormPoint } from '../../types'
import { projectPoint } from './projectPoint'

export interface DrawFingerRingArgs {
  ctx: CanvasRenderingContext2D
  tip: NormPoint
  width: number
  height: number
  mirror?: boolean
  color: string
  radius: number
  lineWidth?: number
}

export const drawFingerRing = ({
  ctx,
  tip,
  width,
  height,
  mirror = false,
  color,
  radius,
  lineWidth = 3
}: DrawFingerRingArgs): void => {
  const { x, y } = projectPoint({ p: tip, width, height, mirror })
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
}
