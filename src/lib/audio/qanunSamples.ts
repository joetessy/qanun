/**
 * Note-to-filename map for the CC0 Turkish kanun multisamples.
 * 18 entries spanning F3–Ds6, one every ~2 semitones.
 *
 * Source: Freesound #211133 "kanun_moderate_Chromatic" by barisbozkurt (CC0 1.0).
 * Files are per-note slices of that recording, pitch-detected and renamed to
 * standard Tone.js note names.
 *
 * Keys are Tone.js note names (letter + optional '#' + octave).
 * Values are bare filenames relative to QANUN_SAMPLE_BASE_URL.
 *
 * Tone.Sampler pitch-shifts the nearest sample automatically, so quarter-tones
 * (Arabic microtonal notes) are handled for free.
 */
export const QANUN_SAMPLE_BASE_URL = '/samples/qanun/'

export const QANUN_SAMPLE_URLS: Record<string, string> = {
  'F3':  'qanun-F3.wav',
  'G3':  'qanun-G3.wav',
  'A3':  'qanun-A3.wav',
  'B3':  'qanun-B3.wav',
  'C#4': 'qanun-Cs4.wav',
  'D#4': 'qanun-Ds4.wav',
  'F4':  'qanun-F4.wav',
  'G4':  'qanun-G4.wav',
  'A4':  'qanun-A4.wav',
  'B4':  'qanun-B4.wav',
  'C#5': 'qanun-Cs5.wav',
  'D#5': 'qanun-Ds5.wav',
  'F5':  'qanun-F5.wav',
  'G5':  'qanun-G5.wav',
  'A5':  'qanun-A5.wav',
  'B5':  'qanun-B5.wav',
  'C#6': 'qanun-Cs6.wav',
  'D#6': 'qanun-Ds6.wav',
}
