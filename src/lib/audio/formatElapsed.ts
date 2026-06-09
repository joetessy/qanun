// Formats a sample count as mm:ss for the recording indicator.
// Floors the displayed second (so 01.999s shows "00:01", not "00:02"); caps
// at "99:59" — the max recording length is 10 minutes anyway, so the cap is
// defensive against caller bugs, not a real product constraint.
export const formatElapsed = (samples: number, sampleRate: number): string => {
  if (!Number.isFinite(samples) || samples < 0 || sampleRate <= 0) return '00:00'
  const totalSec = Math.floor(samples / sampleRate)
  const cappedSec = Math.min(totalSec, 99 * 60 + 59)
  const mm = Math.floor(cappedSec / 60)
  const ss = cappedSec % 60
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n))
  return `${pad(mm)}:${pad(ss)}`
}
