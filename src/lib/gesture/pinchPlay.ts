// Pinch-as-button gesture module.
// Treats the thumb–index pinch like a mouse button: the close edge fires ONE
// pluck whose velocity comes from the close speed; the open edge (with
// hysteresis) re-arms it. Everything that happens while the pinch stays closed
// is the engine's job now — the centre-crossing strum replaced 'glide' and the
// middle-finger tremolo replaced 'sustain'.

import { clamp01 } from '../music/clamp01'

export interface PinchPlayEvent {
  type: 'pluck'
  courseIndex: number
  velocity: number
}

export interface PinchPlayOptions {
  closeThreshold?: number
  openThreshold?: number
  velocityRef?: number
  minVelocity?: number
}

export interface PinchPlay {
  update(a: { pinchDist: number; courseIndex: number; tNow: number }): PinchPlayEvent[]
  reset(): void
}

export const createPinchPlay = (opts: PinchPlayOptions = {}): PinchPlay => {
  const closeThreshold = opts.closeThreshold ?? 0.05
  const openThreshold = opts.openThreshold ?? 0.07
  const velocityRef = opts.velocityRef ?? 1.5
  const minVelocity = opts.minVelocity ?? 0.4

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
  }): PinchPlayEvent[] => {
    const events: PinchPlayEvent[] = []

    if (!closed && pinchDist < closeThreshold) {
      // Close edge — pluck on onset, velocity from the approach speed.
      closed = true
      let velocity = minVelocity
      if (prevDist !== null && prevT !== null) {
        const dt = Math.max(1e-3, tNow - prevT)
        const speed = (prevDist - pinchDist) / dt
        velocity = clamp01(speed / velocityRef)
        if (velocity < minVelocity) velocity = minVelocity
      }
      events.push({ type: 'pluck', courseIndex, velocity })
    } else if (closed && pinchDist > openThreshold) {
      // Open edge (hysteresis) — re-arm for the next pluck.
      closed = false
    }

    prevDist = pinchDist
    prevT = tNow
    return events
  }

  const reset = (): void => {
    closed = false
    prevDist = null
    prevT = null
  }

  return { update, reset }
}
