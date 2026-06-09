// Smoothing factor for a first-order low-pass given a cutoff (Hz) and dt (s).
// alpha = 1 / (1 + tau/dt), tau = 1 / (2*pi*cutoff)

export interface AlphaArgs {
  cutoff: number
  dt: number
}

export const alpha = ({ cutoff, dt }: AlphaArgs): number => {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}
