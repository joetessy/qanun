// AudioWorkletProcessor that copies its input channels and posts them to
// the main thread each render quantum (128 frames).
//
// Loaded via `audioContext.audioWorklet.addModule(workletUrl)` where
// `workletUrl` is the Vite `?url` import of this file. This file is NOT
// imported as ESM by the renderer — Vite emits it as a stand-alone asset
// and we hand the URL to addModule().
//
// `registerProcessor` and `AudioWorkletProcessor` are globals provided by
// the AudioWorkletGlobalScope; no imports needed.

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._active = true
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'stop') this._active = false
    }
  }

  process(inputs) {
    if (!this._active) return false // returning false lets the node be GC'd
    const input = inputs[0]
    if (input && input.length > 0 && input[0].length > 0) {
      // Copy each channel so the ArrayBuffer transferred to the main thread
      // doesn't share memory with the worklet's render buffer (which the
      // engine reuses on the next quantum).
      const channels = input.map((ch) => {
        const copy = new Float32Array(ch.length)
        copy.set(ch)
        return copy
      })
      // Transfer the underlying buffers — zero-copy on the main-thread side.
      this.port.postMessage(
        { type: 'samples', channels, frameCount: input[0].length },
        channels.map((c) => c.buffer)
      )
    }
    return true
  }
}

registerProcessor('theremin-recorder', RecorderProcessor)
