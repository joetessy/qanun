// Shared types used across the app.

export interface NormPoint {
  x: number
  y: number
  z?: number
}

// Reverb preset size (consumed by reverbSize.ts / the audio engine).
export type ReverbSize = 'small' | 'medium' | 'hall'

export type QanunStatus = 'idle' | 'loading' | 'running' | 'error'

// Live readout pushed to the HUD (maqam name, home note, last plucked note).
export interface QanunReading {
  maqamName: string
  homeNote: string
  lastPluckMidi: number | null
}
