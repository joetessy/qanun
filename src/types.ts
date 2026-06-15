// Shared types used across the app.

export interface NormPoint {
  x: number
  y: number
  z?: number
}

// Reverb preset size (consumed by reverbSize.ts / the audio engine).
export type ReverbSize = 'small' | 'medium' | 'hall'

// 'no-camera': audio is unlocked and the instrument is fully playable by mouse +
// keyboard, but the webcam (hand tracking) was denied or unavailable. Distinct
// from 'error', which is a hard, mute-instrument failure (audio couldn't start).
export type QanunStatus = 'idle' | 'loading' | 'running' | 'no-camera' | 'error'

// Live readout pushed to the HUD (maqam name, home note, last plucked note).
export interface QanunReading {
  maqamName: string
  homeNote: string
  lastPluckMidi: number | null
}
