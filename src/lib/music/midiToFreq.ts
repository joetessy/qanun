export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)
