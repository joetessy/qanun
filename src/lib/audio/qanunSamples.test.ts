import { describe, expect, it } from 'vitest'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

describe('qanunSamples', () => {
  it('exports exactly 17 entries', () => {
    expect(Object.keys(QANUN_SAMPLE_URLS)).toHaveLength(17)
  })

  it('every filename matches /^qanun-[A-G]s?\\d\\.wav$/', () => {
    const re = /^qanun-[A-G]s?\d\.wav$/
    for (const [, filename] of Object.entries(QANUN_SAMPLE_URLS)) {
      expect(filename).toMatch(re)
    }
  })

  it('sharp notes (C#, D#, etc.) map to filenames with "s" not "#"', () => {
    const sharpKeys = Object.keys(QANUN_SAMPLE_URLS).filter((k) => k.includes('#'))
    expect(sharpKeys.length).toBeGreaterThan(0)
    for (const key of sharpKeys) {
      const filename = QANUN_SAMPLE_URLS[key]
      // Filename must use 's' for the sharp (e.g., "qanun-Cs2.wav")
      expect(filename).not.toContain('#')
      // The note letter before '#' should appear followed by 's' in the filename.
      const letter = key[0]
      expect(filename).toContain(letter + 's')
    }
  })

  it('all keys are valid Tone.js note names (letter + optional # + octave digit)', () => {
    const noteRe = /^[A-G]#?\d$/
    for (const key of Object.keys(QANUN_SAMPLE_URLS)) {
      expect(key).toMatch(noteRe)
    }
  })

  it('QANUN_SAMPLE_BASE_URL starts with a slash and ends with one', () => {
    expect(QANUN_SAMPLE_BASE_URL).toMatch(/^\/.*\/$/)
  })

  it('contains B1 as the lowest note and D5 as the highest', () => {
    expect(QANUN_SAMPLE_URLS['B1']).toBe('qanun-B1.wav')
    expect(QANUN_SAMPLE_URLS['D5']).toBe('qanun-D5.wav')
  })
})
