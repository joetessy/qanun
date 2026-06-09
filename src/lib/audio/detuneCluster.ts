/**
 * Returns frequencies for a cluster of detuned voices, one per cent value.
 *
 * Formula: freqHz * 2^(cents / 1200)
 *
 * The default [-4, 0, +4] mimics a qanun's triple-course: three unison strings
 * tuned within ~4 cents of each other produce the instrument's natural
 * chorus/shimmer (bloom) on every note.
 */
export const detunedFreqs = (
  freqHz: number,
  cents: readonly number[] = [-4, 0, 4]
): number[] => cents.map((c) => freqHz * Math.pow(2, c / 1200))
