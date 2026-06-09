// Detects a vibrato gesture from the vertical (y) wobble of a sustained fingertip.
// Vertical is used because lateral motion is already glide — so vibrato never
// changes the played course. Returns peak detune (cents) + estimated rate (Hz).
export interface VibratoOut { cents: number; rateHz: number }

export interface VibratoOptions {
  windowSec?: number   // analysis window
  maxCents?: number    // clamp
  ampToCents?: number  // normalized-y peak-to-peak → cents gain
  minRateHz?: number
  maxRateHz?: number
}

export interface Vibrato {
  update(a: { y: number; tNow: number; active: boolean }): VibratoOut
  reset(): void
}

const OFF: VibratoOut = { cents: 0, rateHz: 0 }

export const createVibrato = (opts: VibratoOptions = {}): Vibrato => {
  const windowSec = opts.windowSec ?? 0.25
  const maxCents = opts.maxCents ?? 70
  const ampToCents = opts.ampToCents ?? 1400 // 0.05 p2p → ~70 cents
  const minRateHz = opts.minRateHz ?? 3
  const maxRateHz = opts.maxRateHz ?? 9

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
    const cents = Math.min(maxCents, peakToPeak * ampToCents)
    const span = Math.max(1e-3, buf[buf.length - 1].t - buf[0].t)
    const rateHz = Math.min(maxRateHz, Math.max(minRateHz, crossings / (2 * span)))
    if (cents < 1) return { cents: 0, rateHz: 0 }
    return { cents, rateHz }
  }

  const reset = (): void => { buf = [] }
  return { update, reset }
}
