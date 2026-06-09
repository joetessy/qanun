import type { NormPoint } from '../../types'
import { HAND_CONNECTIONS } from './HAND_CONNECTIONS'
import { projectPoint } from './projectPoint'

export interface DrawHandArgs {
  ctx: CanvasRenderingContext2D
  landmarks: NormPoint[]
  width: number
  height: number
  mirror?: boolean
  color?: string
  pointColor?: string
  lineWidth?: number
  pointRadius?: number
}

export const drawHand = ({
  ctx,
  landmarks,
  width,
  height,
  mirror = false,
  color = '#7CFFC4',
  pointColor = '#FFFFFF',
  lineWidth = 2,
  pointRadius = 4
}: DrawHandArgs): void => {
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = color
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = landmarks[a]
    const pb = landmarks[b]
    if (!pa || !pb) continue
    const projA = projectPoint({ p: pa, width, height, mirror })
    const projB = projectPoint({ p: pb, width, height, mirror })
    ctx.moveTo(projA.x, projA.y)
    ctx.lineTo(projB.x, projB.y)
  }
  ctx.stroke()

  ctx.fillStyle = pointColor
  for (const p of landmarks) {
    const proj = projectPoint({ p, width, height, mirror })
    ctx.beginPath()
    ctx.arc(proj.x, proj.y, pointRadius, 0, Math.PI * 2)
    ctx.fill()
  }
}
