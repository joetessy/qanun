/// <reference types="vite/client" />
// Recorder factory. Wraps an AudioWorkletNode that taps the engine's bus
// node, collects float32 samples into a pre-allocated ring buffer, and on
// stop hands the buffered PCM to a Web Worker for WAV encoding.
//
// The "ring buffer" here is actually a write-once linear buffer with a hard
// cap — we don't wrap around. Recording stops cleanly when the cap is hit.
// (The spec calls it a ring buffer; the semantics here are "fixed-capacity
// accumulator". Same shape, no wraparound complexity.)

import workletUrl from './recorder-worklet.js?url'
import EncoderWorker from './wav-encoder.worker.ts?worker'

// 'saving' is owned by the consumer (the hook) — set during the post-encode
// window when the file is being written via the platform save dialog. The
// recorder itself only transitions through idle/recording/encoding.
export type RecorderState = 'idle' | 'recording' | 'encoding' | 'saving'

export interface CreateRecorderOptions {
  audioContext: AudioContext
  sourceNode: AudioNode
  // Max recording length in seconds. Default 600 (10 minutes).
  maxDurationSec?: number
  // Notified when state transitions.
  onStateChange?: (state: RecorderState) => void
  // Fired exactly once when the buffer caps out (recording continues to
  // auto-stop and post results — the UI uses this to surface a toast).
  onMaxDurationReached?: () => void
  // Fired if the encoder worker errors / crashes. The partial PCM (whatever
  // is buffered) is offered as a partial WAV via the resolved `stop()`
  // promise's `partial` flag.
  onEncoderError?: (message: string) => void
}

export interface Recorder {
  start: () => Promise<void>
  stop: () => Promise<{ wav: ArrayBuffer; sampleRate: number; partial: boolean }>
  cancel: () => void
  getElapsedFrames: () => number
  getState: () => RecorderState
  dispose: () => void
}

interface RingBuffer {
  channels: Float32Array[]
  capacityFrames: number
  lengthFrames: number
  overflowFired: boolean
}

// Exposed only for unit tests — production code uses the factory below.
export const __testOnly_createRingBuffer = ({
  channelCount,
  capacityFrames
}: {
  channelCount: number
  capacityFrames: number
}): RingBuffer => ({
  channels: Array.from({ length: channelCount }, () => new Float32Array(capacityFrames)),
  capacityFrames,
  lengthFrames: 0,
  overflowFired: false
})

export const __testOnly_appendSamples = (
  buf: RingBuffer,
  incoming: Float32Array[],
  onOverflow: () => void
): { lengthFrames: number; overflowed: boolean } => {
  const incomingLen = incoming[0]?.length ?? 0
  const room = buf.capacityFrames - buf.lengthFrames
  const writeLen = Math.min(room, incomingLen)
  for (let ch = 0; ch < buf.channels.length; ch += 1) {
    const src = incoming[ch] ?? incoming[0] // duplicate to fill if mono input on stereo buffer
    buf.channels[ch].set(src.subarray(0, writeLen), buf.lengthFrames)
  }
  buf.lengthFrames += writeLen
  const overflowed = writeLen < incomingLen
  if (overflowed && !buf.overflowFired) {
    buf.overflowFired = true
    onOverflow()
  }
  return { lengthFrames: buf.lengthFrames, overflowed }
}

const workletModuleRegistered = new WeakMap<BaseAudioContext, Promise<void>>()

const ensureWorkletRegistered = async (ctx: BaseAudioContext): Promise<void> => {
  const existing = workletModuleRegistered.get(ctx)
  if (existing) return existing
  const promise = ctx.audioWorklet.addModule(workletUrl)
  workletModuleRegistered.set(ctx, promise)
  return promise
}

export const createRecorder = ({
  audioContext,
  sourceNode,
  maxDurationSec = 600,
  onStateChange,
  onMaxDurationReached,
  onEncoderError
}: CreateRecorderOptions): Recorder => {
  const sampleRate = audioContext.sampleRate
  const capacityFrames = Math.floor(sampleRate * maxDurationSec)
  // The source bus is stereo at the destination — allocate 2 channels.
  const buffer: RingBuffer = __testOnly_createRingBuffer({
    channelCount: 2,
    capacityFrames
  })

  let state: RecorderState = 'idle'
  let workletNode: AudioWorkletNode | null = null
  let autoStopTimer: number | null = null
  // Tracks an in-flight encoder worker so cancel() can terminate it and
  // reject the pending stop() promise — otherwise a "cancelled" recording's
  // save dialog can pop up moments after the user explicitly cancelled.
  let activeEncoder: { worker: Worker; reject: (e: Error) => void } | null = null

  const setState = (next: RecorderState): void => {
    state = next
    onStateChange?.(state)
  }

  const cleanupWorklet = (): void => {
    if (workletNode) {
      workletNode.port.postMessage({ type: 'stop' })
      try {
        sourceNode.disconnect(workletNode)
      } catch {
        // Already disconnected — fine.
      }
      workletNode.disconnect()
      workletNode = null
    }
    if (autoStopTimer !== null) {
      window.clearTimeout(autoStopTimer)
      autoStopTimer = null
    }
  }

  const start = async (): Promise<void> => {
    if (state !== 'idle') throw new Error(`createRecorder.start: bad state ${state}`)
    await ensureWorkletRegistered(audioContext)
    // Reset the buffer for a fresh take.
    buffer.lengthFrames = 0
    buffer.overflowFired = false
    workletNode = new AudioWorkletNode(audioContext, 'theremin-recorder', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers'
    })
    workletNode.port.onmessage = (event: MessageEvent): void => {
      const data = event.data as { type: string; channels: Float32Array[]; frameCount: number }
      if (data.type !== 'samples') return
      const result = __testOnly_appendSamples(buffer, data.channels, () => {
        onMaxDurationReached?.()
        // Auto-stop on next tick so the consumer's onMaxDurationReached
        // handler can run first.
        if (autoStopTimer === null) {
          autoStopTimer = window.setTimeout(() => {
            void stop().catch(() => {})
          }, 0)
        }
      })
      void result
    }
    sourceNode.connect(workletNode)
    setState('recording')
  }

  const stop = async (): Promise<{ wav: ArrayBuffer; sampleRate: number; partial: boolean }> => {
    if (state !== 'recording') {
      throw new Error(`createRecorder.stop: bad state ${state}`)
    }
    cleanupWorklet()
    setState('encoding')

    return new Promise((resolve, reject) => {
      const worker = new EncoderWorker()
      activeEncoder = { worker, reject }
      // Currently always false — recordings either encode fully (worker or
      // sync fallback) or fail. Kept in the resolved shape for future use
      // (e.g., if we ever surface a truncated take).
      const partial = false
      // Snapshot the lengths/buffers we'll send so a late worklet message
      // can't mutate them mid-flight (cleanupWorklet already disconnected
      // the source, so there shouldn't be any, but defensive).
      const channelsCopy = buffer.channels.map((ch) =>
        ch.slice(0, buffer.lengthFrames)
      )
      const lengthFrames = buffer.lengthFrames

      const handleMessage = (event: MessageEvent): void => {
        const data = event.data as { type: 'ok' | 'error'; wav?: ArrayBuffer; message?: string }
        worker.terminate()
        activeEncoder = null
        setState('idle')
        if (data.type === 'ok' && data.wav) {
          resolve({ wav: data.wav, sampleRate, partial })
        } else {
          const message = data.message ?? 'unknown encoder error'
          onEncoderError?.(message)
          reject(new Error(message))
        }
      }

      const handleError = (err: ErrorEvent): void => {
        worker.terminate()
        activeEncoder = null
        setState('idle')
        const message = err.message || 'encoder worker crashed'
        // Fall back: encode synchronously on the main thread so the user
        // doesn't lose the take. Acceptable because this is the exceptional
        // path — the normal happy path stays off the main thread. The encode
        // is complete (we have every buffered frame), so partial stays false
        // on success; only fire onEncoderError if even the fallback fails.
        import('./encodeWavSync').then(({ encodeWavSync }) => {
          try {
            const wav = encodeWavSync({
              channels: channelsCopy,
              sampleRate,
              lengthFrames
            })
            resolve({ wav, sampleRate, partial })
          } catch (fallbackErr) {
            onEncoderError?.(message)
            reject(fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)))
          }
        })
      }

      worker.addEventListener('message', handleMessage)
      worker.addEventListener('error', handleError)
      worker.postMessage(
        { channels: channelsCopy, sampleRate, lengthFrames },
        channelsCopy.map((c) => c.buffer)
      )
    })
  }

  const cancel = (): void => {
    cleanupWorklet()
    if (activeEncoder !== null) {
      activeEncoder.worker.terminate()
      const cancelError = new Error('cancelled')
      ;(cancelError as Error & { code?: string }).code = 'cancelled'
      activeEncoder.reject(cancelError)
      activeEncoder = null
    }
    buffer.lengthFrames = 0
    buffer.overflowFired = false
    setState('idle')
  }

  const getElapsedFrames = (): number => buffer.lengthFrames
  const getState = (): RecorderState => state

  const dispose = (): void => {
    cleanupWorklet()
    // Intentionally do NOT reset workletModuleRegistered. The WeakMap is keyed
    // by AudioContext and self-cleans when the context is GC'd. Resetting it
    // here would (a) defeat caching for other recorders sharing the same
    // context (HMR / tests) and (b) make the next start() re-register the
    // module unnecessarily.
  }

  return { start, stop, cancel, getElapsedFrames, getState, dispose }
}
