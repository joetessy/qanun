import { DEGREE_COUNT } from '../music/ajnas/MANDALS'

// The mandal zone is the far-left strip where the real mandals sit. x is a
// normalized screen coordinate (0 = screen-left), already mirrored.
export const MANDAL_ZONE_RIGHT = 0.18

export const isInMandalZone = (x: number, zoneRight = MANDAL_ZONE_RIGHT): boolean =>
  x <= zoneRight

// Which lever the fingertip is on. y is 0 at the top of frame, 1 at the bottom.
// Top band = highest degree (7), bottom band = degree 1.
export const mandalLeverFromY = (y: number, degreeCount = DEGREE_COUNT): number => {
  // Clamp just under 1 so Math.floor(clamped * degreeCount) stays in
  // [0, degreeCount-1]; a raw y of 1.0 would otherwise floor to degreeCount.
  const clamped = Math.min(0.999999, Math.max(0, y))
  const band = Math.floor(clamped * degreeCount) // 0 (top) .. degreeCount-1 (bottom)
  return degreeCount - band
}

export interface MandalEvent {
  degree: number
  direction: 1 | -1
}

export interface MandalGestureOptions {
  flickSpeed?: number     // |dy|/dt (units/sec) to count as a flick
  settleSpeed?: number    // |dy|/dt below which the gesture re-arms
  pinchClose?: number     // pinch distance for the cycle fallback
  pinchOpen?: number       // re-arm threshold for the pinch fallback
}

export interface MandalGesture {
  update: (args: { x: number; y: number; pinchDist: number; tNow: number }) => MandalEvent | null
  reset: () => void
}

// Vertical flick (sign of y-velocity) raises/lowers the lever under the
// fingertip; pinch-to-cycle is a reliable fallback. Both debounce until motion
// settles / the pinch re-opens.
export const createMandalGesture = ({
  flickSpeed = 1.5,
  settleSpeed = 0.6,
  pinchClose = 0.05,
  pinchOpen = 0.07
}: MandalGestureOptions = {}): MandalGesture => {
  let prevY: number | null = null
  let prevT: number | null = null
  let armed = true
  let pinchClosed = false

  const update = ({
    x: _x,
    y,
    pinchDist,
    tNow
  }: {
    x: number
    y: number
    pinchDist: number
    tNow: number
  }): MandalEvent | null => {
    const degree = mandalLeverFromY(y)
    let event: MandalEvent | null = null

    // Pinch-to-cycle fallback (onset edge → raise).
    if (!pinchClosed && pinchDist < pinchClose) {
      pinchClosed = true
      event = { degree, direction: 1 }
    } else if (pinchClosed && pinchDist > pinchOpen) {
      pinchClosed = false
    }

    // Vertical flick.
    if (!event && prevY !== null && prevT !== null) {
      const dt = Math.max(1e-3, tNow - prevT)
      const vy = (y - prevY) / dt // negative = upward
      const speed = Math.abs(vy)
      if (armed && speed >= flickSpeed) {
        event = { degree, direction: vy < 0 ? 1 : -1 }
        armed = false
      } else if (!armed && speed <= settleSpeed) {
        armed = true
      }
    }

    prevY = y
    prevT = tNow
    return event
  }

  const reset = (): void => {
    prevY = null
    prevT = null
    armed = true
    pinchClosed = false
  }

  return { update, reset }
}
