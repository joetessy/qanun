import { describe, it, expect } from 'vitest'
import { freqToNoteBend, bendToPitchBend14, nextMpeChannel } from './microtonal'
import { midiToFreq } from '../music/midiToFreq'

// ── freqToNoteBend ────────────────────────────────────────────────────────────

describe('freqToNoteBend', () => {
  it('A4 440 Hz → note 69, bend 0', () => {
    const { note, bendCents } = freqToNoteBend(440)
    expect(note).toBe(69)
    expect(bendCents).toBeCloseTo(0, 6)
  })

  it('C4 261.63 Hz → note 60, bend ≈ 0', () => {
    const { note, bendCents } = freqToNoteBend(261.63)
    expect(note).toBe(60)
    expect(Math.abs(bendCents)).toBeLessThan(1)   // within 1 cent of center
  })

  it('MIDI 51.5 (quarter-tone between B3 and C4) → note 52, bend −50', () => {
    // midiToFreq(51.5) gives the exact half-semitone pitch.
    const freqHz = midiToFreq(51.5)
    const { note, bendCents } = freqToNoteBend(freqHz)
    // Math.round(51.5) = 52 (rounds up)
    expect(note).toBe(52)
    expect(bendCents).toBeCloseTo(-50, 4)
  })

  it('MIDI 51.0 → note 51, bend 0 cents', () => {
    const freqHz = midiToFreq(51)
    const { note, bendCents } = freqToNoteBend(freqHz)
    expect(note).toBe(51)
    expect(bendCents).toBeCloseTo(0, 4)
  })

  it('a quarter-tone above A4 (MIDI 69.5) → note 70, bend −50', () => {
    const freqHz = midiToFreq(69.5)
    const { note, bendCents } = freqToNoteBend(freqHz)
    expect(note).toBe(70)
    expect(bendCents).toBeCloseTo(-50, 4)
  })

  it('25 cents sharp of D4 (MIDI 62.25) → note 62, bend +25', () => {
    const freqHz = midiToFreq(62.25)
    const { note, bendCents } = freqToNoteBend(freqHz)
    expect(note).toBe(62)
    expect(bendCents).toBeCloseTo(25, 4)
  })
})

// ── bendToPitchBend14 ─────────────────────────────────────────────────────────

describe('bendToPitchBend14', () => {
  it('0 cents → 8192 (center)', () => {
    expect(bendToPitchBend14(0, 2)).toBe(8192)
  })

  it('+1 semitone worth with bendRange=1 → ~16383 (full up)', () => {
    // (100 cents / 100) / 1 semi * 8192 = +8192 → 8192+8192 = 16384, clamped to 16383
    expect(bendToPitchBend14(100, 1)).toBe(16383)
  })

  it('−1 semitone worth with bendRange=1 → ~1 (full down)', () => {
    // 8192 − 8192 = 0
    expect(bendToPitchBend14(-100, 1)).toBe(0)
  })

  it('symmetric: +N and −N are equidistant from 8192', () => {
    const up = bendToPitchBend14(50, 2)
    const down = bendToPitchBend14(-50, 2)
    expect(up - 8192).toBe(8192 - down)
  })

  it('+50 cents with bendRange=2 → 8192 + 2048 = 10240', () => {
    // (50/100) / 2 * 8192 = 0.25 * 8192 = 2048 → 8192+2048 = 10240
    expect(bendToPitchBend14(50, 2)).toBe(10240)
  })

  it('−50 cents with bendRange=2 → 8192 − 2048 = 6144', () => {
    expect(bendToPitchBend14(-50, 2)).toBe(6144)
  })

  it('clamps to 0 below floor', () => {
    expect(bendToPitchBend14(-9999, 1)).toBe(0)
  })

  it('clamps to 16383 above ceiling', () => {
    expect(bendToPitchBend14(9999, 1)).toBe(16383)
  })
})

// ── nextMpeChannel ────────────────────────────────────────────────────────────

describe('nextMpeChannel', () => {
  const channels = [1, 2, 3, 4, 5] as const

  it('returns next channel after current', () => {
    expect(nextMpeChannel(1, channels)).toBe(2)
    expect(nextMpeChannel(3, channels)).toBe(4)
    expect(nextMpeChannel(5, channels)).toBe(1) // wraps
  })

  it('wraps around at end of list', () => {
    expect(nextMpeChannel(5, channels)).toBe(1)
  })

  it('returns channels[0] when current is not in the list', () => {
    expect(nextMpeChannel(99, channels)).toBe(1)
  })

  it('single-element list always returns that element', () => {
    expect(nextMpeChannel(7, [7])).toBe(7)
    expect(nextMpeChannel(99, [7])).toBe(7)
  })

  it('returns current when channels is empty', () => {
    expect(nextMpeChannel(3, [])).toBe(3)
  })
})
