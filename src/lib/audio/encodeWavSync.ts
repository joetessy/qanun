// Pure, synchronous WAV encoder. Lives in its own module so it can be
// unit-tested without spinning up a Web Worker. The Worker entry point
// (`wav-encoder.worker.ts`) imports this and calls it on messages from the
// main thread.
//
// Format: WAVE / PCM / 16-bit / interleaved. The header is the standard
// 44-byte RIFF/WAVE/fmt /data layout — no LIST or fact chunks. This is what
// QuickTime, Logic, Ableton, ffmpeg, and Audacity all accept without
// complaint, and what the spec calls for.

export interface EncodeWavInput {
  // One Float32Array per channel (mono=1, stereo=2). All channels MUST be
  // the same length; pass `lengthFrames` for the count of valid frames
  // (channels may be allocated larger as ring buffers — only the first
  // `lengthFrames` entries are encoded).
  channels: Float32Array[]
  sampleRate: number
  lengthFrames: number
}

const BIT_DEPTH = 16
const BYTES_PER_SAMPLE = BIT_DEPTH / 8

const writeAscii = (view: DataView, offset: number, text: string): void => {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

const floatToInt16 = (sample: number): number => {
  // Clamp first so out-of-range floats don't wrap; then scale.
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample
  return Math.round(clamped * 32767)
}

export const encodeWavSync = ({
  channels,
  sampleRate,
  lengthFrames
}: EncodeWavInput): ArrayBuffer => {
  if (channels.length === 0) {
    throw new Error('encodeWavSync: at least one channel required')
  }
  const numChannels = channels.length
  const dataBytes = lengthFrames * numChannels * BYTES_PER_SAMPLE
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  // RIFF chunk descriptor
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true) // file size - 8
  writeAscii(view, 8, 'WAVE')

  // fmt sub-chunk
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true)  // PCM format code
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * BYTES_PER_SAMPLE, true) // byte rate
  view.setUint16(32, numChannels * BYTES_PER_SAMPLE, true) // block align
  view.setUint16(34, BIT_DEPTH, true)

  // data sub-chunk
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  // Interleave channels and write int16 samples.
  let offset = 44
  for (let frame = 0; frame < lengthFrames; frame += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      view.setInt16(offset, floatToInt16(channels[ch][frame]), true)
      offset += BYTES_PER_SAMPLE
    }
  }

  return buffer
}
