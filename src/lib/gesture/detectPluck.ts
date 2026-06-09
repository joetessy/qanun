// Pinch-onset pluck detector. A pluck fires on the open→closed edge of the
// thumb–index pinch; the target course is sampled at that onset frame (so
// index drift during the pinch doesn't move the note). Hysteresis: the pinch
// must re-open past `openThreshold` before it can fire again.
export interface PluckEvent {
  courseIndex: number
  velocity: number
}

export interface PluckDetectorOptions {
  closeThreshold?: number // pinch distance below which the pinch is "closed"
  openThreshold?: number  // distance above which it re-arms (> closeThreshold)
  velocityRef?: number    // closing speed (units/sec) that maps to velocity 1
  minVelocity?: number    // floor when timing is unavailable
}

export interface PluckDetector {
  update: (args: { pinchDist: number; courseIndex: number; tNow: number }) => PluckEvent | null
  reset: () => void
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

export const createPluckDetector = ({
  closeThreshold = 0.05,
  openThreshold = 0.07,
  velocityRef = 1.5,
  minVelocity = 0.4
}: PluckDetectorOptions = {}): PluckDetector => {
  let closed = false
  let prevDist: number | null = null
  let prevT: number | null = null

  const update = ({
    pinchDist,
    courseIndex,
    tNow
  }: {
    pinchDist: number
    courseIndex: number
    tNow: number
  }): PluckEvent | null => {
    let event: PluckEvent | null = null
    if (!closed && pinchDist < closeThreshold) {
      // Onset edge.
      closed = true
      let velocity = minVelocity
      if (prevDist !== null && prevT !== null) {
        const dt = Math.max(1e-3, tNow - prevT)
        const speed = (prevDist - pinchDist) / dt
        velocity = clamp01(speed / velocityRef)
        if (velocity < minVelocity) velocity = minVelocity
      }
      event = { courseIndex, velocity }
    } else if (closed && pinchDist > openThreshold) {
      closed = false
    }
    prevDist = pinchDist
    prevT = tNow
    return event
  }

  const reset = (): void => {
    closed = false
    prevDist = null
    prevT = null
  }

  return { update, reset }
}
