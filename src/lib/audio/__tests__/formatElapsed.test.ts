import { describe, it, expect } from 'vitest'
import { formatElapsed } from '../formatElapsed'

describe('formatElapsed', () => {
  it('formats zero samples as 00:00', () => {
    expect(formatElapsed(0, 48000)).toBe('00:00')
  })

  it('formats exact minute boundaries', () => {
    expect(formatElapsed(48000 * 60, 48000)).toBe('01:00')
    expect(formatElapsed(48000 * 125, 48000)).toBe('02:05')
  })

  it('floors fractional seconds (no rounding up of the displayed second)', () => {
    // 1.999 seconds — still showing 01.
    expect(formatElapsed(Math.floor(48000 * 1.999), 48000)).toBe('00:01')
  })

  it('pads single-digit minutes and seconds', () => {
    expect(formatElapsed(48000 * 5, 48000)).toBe('00:05')
    expect(formatElapsed(48000 * 65, 48000)).toBe('01:05')
  })

  it('caps display at 99:59 (instead of overflowing to three digits)', () => {
    // 100 minutes worth of samples.
    expect(formatElapsed(48000 * 60 * 100, 48000)).toBe('99:59')
  })

  it('returns 00:00 for non-finite inputs', () => {
    expect(formatElapsed(Number.NaN, 48000)).toBe('00:00')
    expect(formatElapsed(-100, 48000)).toBe('00:00')
  })
})
