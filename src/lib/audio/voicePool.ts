// Round-robin index into a fixed pool of synth voices (voice stealing).
export const nextVoiceIndex = (current: number, size: number): number =>
  (current + 1) % size
