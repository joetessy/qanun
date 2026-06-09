// Pinch-as-button gesture module.
// Treats the thumb–index pinch like a mouse button:
//   close  → quick pluck (velocity from close speed)
//   held still (past holdDelaySec) → sustain (rashsh)
//   held + move across courses → glide (pluck each new course; cancels sustain)
//   open  → release any sustain

export type PinchPlayEvent =
  | { type: 'pluck'; courseIndex: number; velocity: number }
  | { type: 'glide'; courseIndex: number; velocity: number }
  | { type: 'sustain'; courseIndex: number; velocity: number }
  | { type: 'release' }

export interface PinchPlayOptions {
  closeThreshold?: number
  openThreshold?: number
  holdDelaySec?: number
  velocityRef?: number
  minVelocity?: number
  glideVelocity?: number
  sustainVelocity?: number
}

export interface PinchPlay {
  update(a: { pinchDist: number; courseIndex: number; tNow: number }): PinchPlayEvent[]
  reset(): void
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

export const createPinchPlay = (opts: PinchPlayOptions = {}): PinchPlay => {
  const closeThreshold = opts.closeThreshold ?? 0.05
  const openThreshold = opts.openThreshold ?? 0.07
  const holdDelaySec = opts.holdDelaySec ?? 0.18
  const velocityRef = opts.velocityRef ?? 1.5
  const minVelocity = opts.minVelocity ?? 0.4
  const glideVelocity = opts.glideVelocity ?? 0.55
  const sustainVelocity = opts.sustainVelocity ?? 0.6

  let closed = false
  let course = 0
  let closeT = 0
  let sustaining = false
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
  }): PinchPlayEvent[] => {
    const events: PinchPlayEvent[] = []

    if (!closed && pinchDist < closeThreshold) {
      // Close edge — pluck on onset
      closed = true
      course = courseIndex
      closeT = tNow
      sustaining = false
      let velocity = minVelocity
      if (prevDist !== null && prevT !== null) {
        const dt = Math.max(1e-3, tNow - prevT)
        const speed = (prevDist - pinchDist) / dt
        velocity = clamp01(speed / velocityRef)
        if (velocity < minVelocity) velocity = minVelocity
      }
      events.push({ type: 'pluck', courseIndex, velocity })
    } else if (closed && pinchDist > openThreshold) {
      // Open edge — release sustain if active
      if (sustaining) events.push({ type: 'release' })
      closed = false
      sustaining = false
    } else if (closed) {
      // Held — check for course change (glide) or sustain onset
      if (courseIndex !== course) {
        // Finger moved to a new course
        if (sustaining) {
          events.push({ type: 'release' })
          sustaining = false
        }
        events.push({ type: 'glide', courseIndex, velocity: glideVelocity })
        course = courseIndex
        closeT = tNow // reset hold timer on each glide
      } else if (!sustaining && tNow - closeT >= holdDelaySec) {
        // Held still long enough — start sustain
        events.push({ type: 'sustain', courseIndex: course, velocity: sustainVelocity })
        sustaining = true
      }
    }

    prevDist = pinchDist
    prevT = tNow
    return events
  }

  const reset = (): void => {
    closed = false
    course = 0
    closeT = 0
    sustaining = false
    prevDist = null
    prevT = null
  }

  return { update, reset }
}
