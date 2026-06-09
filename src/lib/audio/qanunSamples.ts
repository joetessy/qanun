/**
 * Note-to-filename map for the VCSL Dan Tranh + Psaltery sample set (CC0).
 * 17 entries spanning B1–D5, one every ~2–3 semitones.
 *
 * Keys are Tone.js note names (letter + optional '#' + octave).
 * Values are bare filenames relative to QANUN_SAMPLE_BASE_URL.
 *
 * Tone.Sampler pitch-shifts the nearest sample automatically, so quarter-tones
 * (Arabic microtonal notes) are handled for free.
 */
export const QANUN_SAMPLE_BASE_URL = '/samples/qanun/'

export const QANUN_SAMPLE_URLS: Record<string, string> = {
  'B1':  'qanun-B1.wav',
  'C#2': 'qanun-Cs2.wav',
  'D#2': 'qanun-Ds2.wav',
  'F#2': 'qanun-Fs2.wav',
  'G#2': 'qanun-Gs2.wav',
  'B2':  'qanun-B2.wav',
  'C#3': 'qanun-Cs3.wav',
  'D#3': 'qanun-Ds3.wav',
  'F#3': 'qanun-Fs3.wav',
  'G#3': 'qanun-Gs3.wav',
  'B3':  'qanun-B3.wav',
  'C#4': 'qanun-Cs4.wav',
  'D#4': 'qanun-Ds4.wav',
  'F#4': 'qanun-Fs4.wav',
  'G#4': 'qanun-Gs4.wav',
  'B4':  'qanun-B4.wav',
  'D5':  'qanun-D5.wav',
}
