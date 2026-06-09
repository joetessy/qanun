export const freqToMidi = (freq: number): number => 12 * Math.log2(freq / 440) + 69
