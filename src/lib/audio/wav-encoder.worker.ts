// Web Worker that encodes float32 PCM channels into a 16-bit PCM WAV
// ArrayBuffer. Encoding 10 minutes of 48 kHz stereo = ~55 MB of int16 plus
// the float→int16 loop — non-trivial work we keep off the audio/UI thread.
//
// Imported by the renderer with the `?worker` Vite suffix, e.g.:
//   import EncoderWorker from './wav-encoder.worker.ts?worker'
//   const worker = new EncoderWorker()
//
// Protocol:
//   main → worker:  { channels: Float32Array[], sampleRate, lengthFrames }
//                   (channel buffers transferred — main thread loses them)
//   worker → main:  { type: 'ok', wav: ArrayBuffer } | { type: 'error', message: string }

import { encodeWavSync } from './encodeWavSync'

interface EncodeRequest {
  channels: Float32Array[]
  sampleRate: number
  lengthFrames: number
}

self.onmessage = (event: MessageEvent<EncodeRequest>): void => {
  try {
    const { channels, sampleRate, lengthFrames } = event.data
    const wav = encodeWavSync({ channels, sampleRate, lengthFrames })
    ;(self as unknown as Worker).postMessage({ type: 'ok', wav }, [wav])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ;(self as unknown as Worker).postMessage({ type: 'error', message })
  }
}
