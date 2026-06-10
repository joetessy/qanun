import type { NormPoint } from '../../types'

// MediaPipe puts a fingertip landmark at the CENTRE of the distal pad, not the
// nail tip — and occlusion during a pinch drags the thumb's even further inward.
// Extrapolating along the last bone segment (IP joint → tip) pushes the point
// out to where the tip visually is. k is the fraction of that segment to extend.
export const THUMB_TIP_EXTRAPOLATION = 0.25

export interface ExtrapolateTipArgs {
  tip: NormPoint
  ip: NormPoint
  k?: number
}

export const extrapolateTip = ({ tip, ip, k = THUMB_TIP_EXTRAPOLATION }: ExtrapolateTipArgs): NormPoint => ({
  x: tip.x + k * (tip.x - ip.x),
  y: tip.y + k * (tip.y - ip.y)
})
