import type { RakeSensitivity } from '../../types'

// Rake (glissando) detector. When the playing fingertip crosses course
// boundaries fast enough, each newly crossed course is plucked in turn. Speed
// is measured in courses/second; the threshold is set by sensitivity so
// beginners avoid accidental glissandos ("subtle") and pros can rip ("full").
// RakeSensitivity is the app-canonical type (src/types.ts); re-exported here so
// call-sites can import it alongside the detector.
export type { RakeSensitivity }

// Courses/second a crossing must exceed to register as a rake. "subtle" needs
// a deliberately fast sweep; "full" triggers easily.
const THRESHOLD: Record<RakeSensitivity, number> = {
  off: Infinity,
  subtle: 12,
  full: 4
}

export interface RakeDetectorOptions {
  sensitivity?: RakeSensitivity
}

export interface RakeDetector {
  update: (args: { courseIndex: number; tNow: number }) => number[]
  setSensitivity: (s: RakeSensitivity) => void
  reset: () => void
}

export const createRakeDetector = ({
  sensitivity = 'subtle'
}: RakeDetectorOptions = {}): RakeDetector => {
  let current: RakeSensitivity = sensitivity
  let prevIndex: number | null = null
  let prevT: number | null = null

  const update = ({ courseIndex, tNow }: { courseIndex: number; tNow: number }): number[] => {
    if (prevIndex === null || prevT === null) {
      prevIndex = courseIndex
      prevT = tNow
      return []
    }
    const delta = courseIndex - prevIndex
    const dt = Math.max(1e-3, tNow - prevT)
    const speed = Math.abs(delta) / dt
    const out: number[] = []
    if (delta !== 0 && speed >= THRESHOLD[current]) {
      const step = delta > 0 ? 1 : -1
      for (let c = prevIndex + step; step > 0 ? c <= courseIndex : c >= courseIndex; c += step) {
        out.push(c)
      }
    }
    prevIndex = courseIndex
    prevT = tNow
    return out
  }

  const setSensitivity = (s: RakeSensitivity): void => {
    current = s
  }

  const reset = (): void => {
    prevIndex = null
    prevT = null
  }

  return { update, setSensitivity, reset }
}
