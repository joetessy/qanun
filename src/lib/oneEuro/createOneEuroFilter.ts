import { alpha } from './alpha'
import { createLowPass } from './createLowPass'
import type { OneEuroFilter, OneEuroOptions } from './types'

// One-Euro adaptive low-pass — low jitter at rest, low lag during fast motion.
// See: https://gery.casiez.net/1euro/
export const createOneEuroFilter = ({
  minCutoff = 1.0,
  beta = 0.05,
  dCutoff = 1.0
}: OneEuroOptions = {}): OneEuroFilter => {
  const xFilter = createLowPass()
  const dxFilter = createLowPass()
  let tPrev: number | null = null
  let xPrev: number | null = null

  const filter = ({ x, tNow }: { x: number; tNow: number }): number => {
    if (tPrev === null || xPrev === null) {
      tPrev = tNow
      xPrev = x
      xFilter.filter({ x, alpha: 1 })
      dxFilter.filter({ x: 0, alpha: 1 })
      return x
    }
    const dt = Math.max(1e-6, tNow - tPrev)
    const dx = (x - xPrev) / dt
    const eDx = dxFilter.filter({ x: dx, alpha: alpha({ cutoff: dCutoff, dt }) })
    const cutoff = minCutoff + beta * Math.abs(eDx)
    const eX = xFilter.filter({ x, alpha: alpha({ cutoff, dt }) })
    tPrev = tNow
    xPrev = x
    return eX
  }

  const reset = (): void => {
    xFilter.reset()
    dxFilter.reset()
    tPrev = null
    xPrev = null
  }

  return { filter, reset }
}
