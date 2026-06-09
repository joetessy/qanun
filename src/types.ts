// Shared types used across the app.

export interface NormPoint {
  x: number
  y: number
  z?: number
}

// Reverb preset size (consumed by reverbSize.ts / the audio engine).
export type ReverbSize = 'small' | 'medium' | 'hall'

export type QanunStatus = 'idle' | 'loading' | 'running' | 'error'

// Live readout pushed to the HUD a few times a second.
export interface QanunReading {
  maqamName: string
  lowerJins: string | null
  upperJins: string | null
  tonicMidi: number
  homeNote: string
  lastPluckMidi: number | null
}
