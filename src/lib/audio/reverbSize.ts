import type { ReverbSize } from '../../types'

export interface ReverbParams {
  // Tone.Reverb decay in seconds. Drives convolver IR length.
  decaySec: number
  // Tone.Reverb preDelay in seconds — silence before the IR kicks in.
  preDelaySec: number
}

// Three presets, mapped to a perceptual size range. "small" is a tight room,
// "medium" is a live room, "hall" is a concert hall. Values chosen to feel
// musically distinct without burning memory on a too-long convolver buffer.
const TABLE: Readonly<Record<ReverbSize, ReverbParams>> = {
  small:  { decaySec: 1.2, preDelaySec: 0.005 },
  medium: { decaySec: 3.0, preDelaySec: 0.015 },
  hall:   { decaySec: 6.5, preDelaySec: 0.04  }
}

export const reverbSizeToParams = (size: ReverbSize): ReverbParams => {
  // Fall back to medium for unknown values — see test for rationale.
  return TABLE[size] ?? TABLE.medium
}
