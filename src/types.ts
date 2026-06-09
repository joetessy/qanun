// Shared types used across the app.

export interface NormPoint {
  x: number
  y: number
  z?: number
}

// Reverb preset size (consumed by reverbSize.ts / the audio engine).
export type ReverbSize = 'small' | 'medium' | 'hall'
