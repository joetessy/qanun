import { clamp01 } from '../music/clamp01'

export interface VelocityCurveOptions {
  min?: number   // floor so even the gentlest pluck is audible
  max?: number
  gamma?: number // >1 makes soft plucks softer (perceptual shaping)
}

// Map a normalized gesture speed (0..1) to a pluck velocity (min..max).
export const velocityCurve = (
  speed: number,
  { min = 0.15, max = 1, gamma = 1.5 }: VelocityCurveOptions = {}
): number => {
  const shaped = Math.pow(clamp01(speed), gamma)
  return min + (max - min) * shaped
}
