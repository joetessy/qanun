import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { QANUN_SAMPLE_URLS, QANUN_SAMPLE_BASE_URL } from './qanunSamples'

describe('qanunSamples', () => {
  it('exports exactly 18 entries', () => {
    expect(Object.keys(QANUN_SAMPLE_URLS)).toHaveLength(18)
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
      // Filename must use 's' for the sharp (e.g., "qanun-Cs4.wav")
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

  it('contains F3 as the lowest note and D#6 as the highest', () => {
    expect(QANUN_SAMPLE_URLS['F3']).toBe('qanun-F3.wav')
    expect(QANUN_SAMPLE_URLS['D#6']).toBe('qanun-Ds6.wav')
  })

  it('every mapped filename exists on disk in public/samples/qanun/', () => {
    const publicDir = resolve(__dirname, '../../../public/samples/qanun')
    for (const [key, filename] of Object.entries(QANUN_SAMPLE_URLS)) {
      const filePath = resolve(publicDir, filename)
      expect(existsSync(filePath), `missing on disk: ${filename} (key ${key})`).toBe(true)
    }
  })
})
