// Pure microtonal MIDI math — no I/O, fully testable.

const BEND_CENTER = 8192

/**
 * Convert a frequency (Hz) to a MIDI note number + bend offset in cents.
 * `midiFloat = 69 + 12 * log2(freqHz / 440)`
 * `note      = Math.round(midiFloat)` (nearest semitone)
 * `bendCents = (midiFloat - note) * 100`  → −50..+50
 */
export const freqToNoteBend = (freqHz: number): { note: number; bendCents: number } => {
  const midiFloat = 69 + 12 * Math.log2(freqHz / 440)
  const note = Math.round(midiFloat)
  const bendCents = (midiFloat - note) * 100
  return { note, bendCents }
}

/**
 * Convert a cent offset (−50..+50) to a 14-bit pitch-bend word (0..16383).
 * `8192 + round((bendCents/100) / bendRangeSemitones * 8192)`, clamped.
 */
export const bendToPitchBend14 = (bendCents: number, bendRangeSemitones: number): number => {
  const raw = BEND_CENTER + Math.round((bendCents / 100) / bendRangeSemitones * BEND_CENTER)
  return Math.min(16383, Math.max(0, raw))
}

/**
 * Round-robin over a channel list, returning the next channel after `current`.
 * If `current` is not in `channels` the function returns `channels[0]`.
 */
export const nextMpeChannel = (current: number, channels: readonly number[]): number => {
  if (channels.length === 0) return current
  const idx = channels.indexOf(current)
  if (idx === -1) return channels[0]
  return channels[(idx + 1) % channels.length]
}
