// Detects a vibrato gesture from the vertical (y) wobble of a sustained fingertip.
// Vertical is used because lateral motion is already glide — so vibrato never
// changes the played course. Returns peak detune (cents) + estimated rate (Hz).
export interface VibratoOut { cents: number; rateHz: number }

export interface VibratoOptions {
  windowSec?: number      // analysis window
  maxCents?: number       // clamp
  ampToCents?: number     // normalized-y peak-to-peak → cents gain
  minRateHz?: number
  maxRateHz?: number
  minWaveRateHz?: number  // below this estimated rate, treat motion as slow drift → no vibrato
  minCents?: number       // amplitude floor — wobbles quieter than this → no vibrato
  minP2P?: number         // min peak-to-peak vertical travel (normalized) for a deliberate wave
}

export interface Vibrato {
  update(a: { y: number; tNow: number; active: boolean }): VibratoOut
  reset(): void
}

const OFF: VibratoOut = { cents: 0, rateHz: 0 }

export const createVibrato = (opts: VibratoOptions = {}): Vibrato => {
  const windowSec = opts.windowSec ?? 0.25
  const maxCents = opts.maxCents ?? 70
  const ampToCents = opts.ampToCents ?? 700 // 0.06 p2p → ~42 cents (gentle, scales up)
  const minRateHz = opts.minRateHz ?? 3
  const maxRateHz = opts.maxRateHz ?? 9
  // Below this *raw* (pre-clamp) estimated rate, the motion is slow vertical
  // drift — not a deliberate wave — so it produces no vibrato.
  const minWaveRateHz = opts.minWaveRateHz ?? 5.5
  // Amplitude floor: wobbles smaller than this many cents are micro-jitter.
  const minCents = opts.minCents ?? 2
  // A deliberate vibrato wave needs real vertical travel — below this peak-to-peak
  // (fraction of viewport height) it's incidental motion, not an intended wave.
  const minP2P = opts.minP2P ?? 0.03

  let buf: { y: number; t: number }[] = []

  const update = ({ y, tNow, active }: { y: number; tNow: number; active: boolean }): VibratoOut => {
    if (!active) { buf = []; return OFF }
    buf.push({ y, t: tNow })
    while (buf.length > 1 && tNow - buf[0].t > windowSec) buf.shift()
    if (buf.length < 4) return OFF

    const mean = buf.reduce((s, p) => s + p.y, 0) / buf.length
    let min = Infinity, max = -Infinity, crossings = 0, prevSign = 0
    for (const p of buf) {
      if (p.y < min) min = p.y
      if (p.y > max) max = p.y
      const sign = Math.sign(p.y - mean)
      if (sign !== 0 && prevSign !== 0 && sign !== prevSign) crossings++
      if (sign !== 0) prevSign = sign
    }
    const peakToPeak = max - min
    // Not enough vertical travel → incidental motion, not a deliberate wave.
    if (peakToPeak < minP2P) return { cents: 0, rateHz: 0 }
    const cents = Math.min(maxCents, peakToPeak * ampToCents)
    const span = Math.max(1e-3, buf[buf.length - 1].t - buf[0].t)
    // Raw (pre-clamp) wave rate from sign-crossings. Slow drift crosses the
    // mean rarely, so this stays low; a deliberate wave pushes it up.
    const rawRateHz = crossings / (2 * span)
    // Slow drift → not an intentional vibrato.
    if (rawRateHz < minWaveRateHz) return { cents: 0, rateHz: 0 }
    // Micro-jitter amplitude → ignore.
    if (cents < minCents) return { cents: 0, rateHz: 0 }
    const rateHz = Math.min(maxRateHz, Math.max(minRateHz, rawRateHz))
    return { cents, rateHz }
  }

  const reset = (): void => { buf = [] }
  return { update, reset }
}
