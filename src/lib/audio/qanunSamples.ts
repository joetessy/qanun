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
 *
 * ONSET ALIGNMENT (constraint for any future sample swap): every file must put
 * its pluck transient within ~30 ms of the file start. The raw slices carried
 * 0–360 ms of inter-note bleed/room tone before the attack (slicing artifacts of
 * the continuous source recording), and Tone.Sampler has no per-sample start
 * offset — so that variable dead time became per-string LATENCY. At the 9 Hz
 * tremolo (111 ms between strikes) a 50–350 ms skew between two alternating
 * notes audibly flams or even fuses them into unison, differently per string
 * pair. The shipped files are trimmed (attack − 15 ms pre-roll, 5 ms fade-in);
 * re-run the same trim on any replacement samples.
 *
 * FORMAT: mono AAC (.m4a, 96 kbps) — ~5x smaller than the original 16-bit WAVs,
 * which gates time-to-first-sound. AAC adds ~2112 samples (~48 ms) of encoder
 * priming, but the m4a edit list tells decoders to skip it: verified via
 * decodeAudioData in Chromium that the decoded onset is sample-identical to
 * the WAV original (and ffmpeg decode agrees). If a target browser ever
 * ignores the edit list, the priming is UNIFORM across all 18 files, so it
 * adds constant latency — not the per-string skew described above.
 */
export const QANUN_SAMPLE_BASE_URL = '/samples/qanun/'

export const QANUN_SAMPLE_URLS: Record<string, string> = {
  'F3':  'qanun-F3.m4a',
  'G3':  'qanun-G3.m4a',
  'A3':  'qanun-A3.m4a',
  'B3':  'qanun-B3.m4a',
  'C#4': 'qanun-Cs4.m4a',
  'D#4': 'qanun-Ds4.m4a',
  'F4':  'qanun-F4.m4a',
  'G4':  'qanun-G4.m4a',
  'A4':  'qanun-A4.m4a',
  'B4':  'qanun-B4.m4a',
  'C#5': 'qanun-Cs5.m4a',
  'D#5': 'qanun-Ds5.m4a',
  'F5':  'qanun-F5.m4a',
  'G5':  'qanun-G5.m4a',
  'A5':  'qanun-A5.m4a',
  'B5':  'qanun-B5.m4a',
  'C#6': 'qanun-Cs6.m4a',
  'D#6': 'qanun-Ds6.m4a',
}
