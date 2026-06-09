export interface LowPassFilter {
  filter: (args: { x: number; alpha: number }) => number
  reset: () => void
}

export interface OneEuroOptions {
  minCutoff?: number
  beta?: number
  dCutoff?: number
}

export interface OneEuroFilter {
  filter: (args: { x: number; tNow: number }) => number
  reset: () => void
}
