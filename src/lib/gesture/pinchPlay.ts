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
  // While sustaining, require a new course to persist this long before gliding,
  // so a lateral wobble during vibrato doesn't switch strings. 0 = glide
  // immediately (unchanged behaviour).
  glideDebounceSec?: number
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
  const glideDebounceSec = opts.glideDebounceSec ?? 0

  let closed = false
  let course = 0
  let closeT = 0
  let sustaining = false
  let prevDist: number | null = null
  let prevT: number | null = null
  // Course-lock bookkeeping: the candidate course we've drifted to while
  // sustaining, and when that drift began.
  let pendingCourse: number | null = null
  let pendingT = 0

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
      pendingCourse = null
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
      pendingCourse = null
    } else if (closed) {
      // Held — check for course change (glide) or sustain onset
      if (courseIndex !== course) {
        if (sustaining && glideDebounceSec > 0) {
          // Course-lock: require the new course to persist before gliding, so a
          // lateral wobble during vibrato doesn't switch strings.
          if (pendingCourse !== courseIndex) { pendingCourse = courseIndex; pendingT = tNow }
          else if (tNow - pendingT >= glideDebounceSec) {
            events.push({ type: 'release' }); sustaining = false
            events.push({ type: 'glide', courseIndex, velocity: glideVelocity })
            course = courseIndex; closeT = tNow; pendingCourse = null
          }
        } else {
          if (sustaining) { events.push({ type: 'release' }); sustaining = false }
          events.push({ type: 'glide', courseIndex, velocity: glideVelocity })
          course = courseIndex; closeT = tNow
        }
      } else {
        pendingCourse = null // snapped back — cancel any pending glide
        if (!sustaining && tNow - closeT >= holdDelaySec) {
          events.push({ type: 'sustain', courseIndex: course, velocity: sustainVelocity })
          sustaining = true
        }
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
    pendingCourse = null
    pendingT = 0
  }

  return { update, reset }
}
