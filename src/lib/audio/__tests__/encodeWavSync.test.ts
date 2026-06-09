import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { encodeWavSync } from '../encodeWavSync'

const SAMPLE_RATE = 48000
const FREQ_HZ = 440
const DURATION_SEC = 1

const makeSine = (): Float32Array => {
  const out = new Float32Array(SAMPLE_RATE * DURATION_SEC)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.sin((2 * Math.PI * FREQ_HZ * i) / SAMPLE_RATE) * 0.5
  }
  return out
}

describe('encodeWavSync', () => {
  it('encodes mono float32 PCM to a 16-bit WAV matching the golden fixture', () => {
    const pcm = makeSine()
    const wav = encodeWavSync({
      channels: [pcm],
      sampleRate: SAMPLE_RATE,
      lengthFrames: pcm.length
    })
    const golden = readFileSync(
      resolve(__dirname, 'fixtures/sine-440hz-1s-48k.wav')
    )
    const actual = new Uint8Array(wav)
    const expected = new Uint8Array(golden.buffer, golden.byteOffset, golden.byteLength)
    expect(actual.length).toBe(expected.length)
    // Compare header (first 44 bytes) byte-for-byte.
    for (let i = 0; i < 44; i += 1) {
      expect(actual[i]).toBe(expected[i])
    }
    // Compare data chunk byte-for-byte.
    for (let i = 44; i < expected.length; i += 1) {
      expect(actual[i]).toBe(expected[i])
    }
  })

  it('writes correct WAV header fields for stereo 48 kHz', () => {
    const left = new Float32Array(48000)
    const right = new Float32Array(48000)
    const wav = encodeWavSync({
      channels: [left, right],
      sampleRate: 48000,
      lengthFrames: 48000
    })
    const view = new DataView(wav)
    // RIFF chunk descriptor
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF')
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE')
    // fmt sub-chunk
    expect(String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15))).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16) // PCM fmt chunk size
    expect(view.getUint16(20, true)).toBe(1)  // PCM format code
    expect(view.getUint16(22, true)).toBe(2)  // num channels
    expect(view.getUint32(24, true)).toBe(48000) // sample rate
    expect(view.getUint32(28, true)).toBe(48000 * 2 * 2) // byte rate = sr * channels * bytes/sample
    expect(view.getUint16(32, true)).toBe(4)  // block align = channels * bytes/sample
    expect(view.getUint16(34, true)).toBe(16) // bit depth
    // data sub-chunk
    expect(String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39))).toBe('data')
    expect(view.getUint32(40, true)).toBe(48000 * 2 * 2) // data size
    expect(wav.byteLength).toBe(44 + 48000 * 2 * 2)
  })

  it('clamps float samples outside [-1, 1] before int16 conversion', () => {
    const pcm = new Float32Array([2.0, -2.0, 0.5, -0.5])
    const wav = encodeWavSync({ channels: [pcm], sampleRate: 48000, lengthFrames: 4 })
    const view = new DataView(wav)
    // First two samples should clamp to ±1 then scale. The encoder uses
    // symmetric scaling — Math.round(clamped * 32767) — so +1 → +32767 and
    // -1 → -32767 (not -32768; symmetric range trades the extra negative
    // step for guaranteed symmetric polarity around DC).
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32767)
    // 0.5 → 16383 or 16384 depending on rounding rule; spec: round(0.5 * 32767).
    expect(view.getInt16(48, true)).toBe(Math.round(0.5 * 32767))
    expect(view.getInt16(50, true)).toBe(Math.round(-0.5 * 32767))
  })
})
