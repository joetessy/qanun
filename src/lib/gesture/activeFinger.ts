// Resolves which finger is pinching the thumb this frame, so the hand can be in
// exactly one mode: index pinch = pluck/glide (melodic), middle pinch = tremolo.
//
// Inputs are pinch ratios (thumb↔fingertip distance ÷ palm width) so the choice
// is distance-invariant. The result is STICKY with hysteresis: once a finger is
// active it stays active until its ratio relaxes past `openRatio`, so a gesture
// can't flicker between modes mid-play. Only when no finger is held does a fresh
// one engage (whichever is below `closeRatio`; the closer wins a tie).

export type ActiveFinger = 'none' | 'index' | 'middle'

export interface ResolveActiveFingerArgs {
  indexRatio: number
  middleRatio: number
  prev: ActiveFinger
  closeRatio: number
  openRatio: number
}

/** Which finger freshly engages when nothing is currently held. */
const pickEngaged = (indexRatio: number, middleRatio: number, closeRatio: number): ActiveFinger => {
  const indexClose = indexRatio < closeRatio
  const middleClose = middleRatio < closeRatio
  // Middle wins a tie so a deliberate two-finger curl reads as tremolo, not pluck.
  if (middleClose && (!indexClose || middleRatio <= indexRatio)) return 'middle'
  if (indexClose) return 'index'
  return 'none'
}

export const resolveActiveFinger = ({
  indexRatio,
  middleRatio,
  prev,
  closeRatio,
  openRatio
}: ResolveActiveFingerArgs): ActiveFinger => {
  // Stay in the current mode until that finger clearly releases (hysteresis).
  if (prev === 'index' && indexRatio <= openRatio) return 'index'
  if (prev === 'middle' && middleRatio <= openRatio) return 'middle'
  return pickEngaged(indexRatio, middleRatio, closeRatio)
}
