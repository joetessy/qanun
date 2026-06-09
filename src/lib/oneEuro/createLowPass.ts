import type { LowPassFilter } from './types'

// First-order exponential low-pass with state captured in closure.
export const createLowPass = (): LowPassFilter => {
  let hatXPrev: number | null = null

  const filter = ({ x, alpha }: { x: number; alpha: number }): number => {
    if (hatXPrev === null) {
      hatXPrev = x
      return x
    }
    const hatX = alpha * x + (1 - alpha) * hatXPrev
    hatXPrev = hatX
    return hatX
  }

  const reset = (): void => {
    hatXPrev = null
  }

  return { filter, reset }
}
