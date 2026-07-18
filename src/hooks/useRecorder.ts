import { useCallback, useEffect, useRef, useState } from 'react'
import { createRecorder, type Recorder, type RecorderState } from '../lib/audio/createRecorder'
import { formatElapsed } from '../lib/audio/formatElapsed'
import type { QanunEngine } from '../lib/audio/createQanunEngine'

export interface UseRecorderArgs {
  // Brings the audio engine up (lazy first-gesture init) before the recorder
  // tries to tap it.
  ensureAudioEngine: () => Promise<void>
  // The live audio engine, or null before first interaction.
  getEngine: () => QanunEngine | null
  // Engine sample rate — drives the elapsed-time display formatting.
  sampleRate: number
}

export interface UseRecorder {
  recordingState: RecorderState
  recordingElapsedDisplay: string
  startRecording: () => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
}

// P4a: recording. Taps the engine's post-fx bus and downloads a WAV. Lazily
// creates the recorder and disposes it on unmount.
export const useRecorder = ({ ensureAudioEngine, getEngine, sampleRate }: UseRecorderArgs): UseRecorder => {
  // Recording state (idle by default — recorder is lazily created).
  const [recordingState, setRecordingState] = useState<RecorderState>('idle')
  const [recordingElapsedFrames, setRecordingElapsedFrames] = useState(0)
  const recorderRef = useRef<Recorder | null>(null)
  // Timer for polling elapsed frames while recording.
  const elapsedTimerRef = useRef<number | null>(null)

  /** Lazy-create the recorder, wired to the post-fx bus. */
  const ensureRecorder = useCallback(async (): Promise<Recorder> => {
    if (recorderRef.current) return recorderRef.current
    const engine = getEngine()
    if (!engine) throw new Error('Audio engine not initialised before recorder')
    // Tone is already loaded once the engine exists, so this resolves straight
    // from the module cache — the dynamic form only keeps it out of the eager graph.
    const { getContext } = await import('tone')
    if (recorderRef.current) return recorderRef.current // re-check: a concurrent call may have won the await
    const audioContext = getContext().rawContext as AudioContext
    const rec = createRecorder({
      audioContext,
      sourceNode: engine.getRecorderTap(),
      onStateChange: (state) => {
        setRecordingState(state)
        if (state !== 'recording') {
          // Stop the elapsed polling timer when no longer recording.
          if (elapsedTimerRef.current !== null) {
            window.clearInterval(elapsedTimerRef.current)
            elapsedTimerRef.current = null
          }
          setRecordingElapsedFrames(0)
        }
      },
      onMaxDurationReached: () => {
        // No toast in this phase; the UI will see state→encoding automatically.
      },
      onEncoderError: () => {
        // Silently ignored — on a worker crash the recorder falls back to a
        // main-thread encode of the full take, so stop() still resolves.
      }
    })
    recorderRef.current = rec
    return rec
  }, [getEngine])

  const startRecording = useCallback(async (): Promise<void> => {
    // Ensure the audio engine is up before we try to tap it.
    await ensureAudioEngine()
    const rec = await ensureRecorder()
    if (rec.getState() !== 'idle') return
    try {
      await rec.start()
    } catch {
      // Lost a double-click race (both calls passed the pre-await guard) or the
      // worklet failed to register — the winning take, if any, owns the timer.
      return
    }
    // The re-entrancy re-check inside rec.start() can resolve without actually
    // starting a second take — only the call that reached 'recording' arms polling.
    if (rec.getState() !== 'recording') return
    // One polling timer at a time: onStateChange only clears the LAST-assigned
    // interval, so an unguarded overwrite would leak the previous one forever.
    if (elapsedTimerRef.current !== null) window.clearInterval(elapsedTimerRef.current)
    // Poll elapsed frames every 500 ms while recording.
    elapsedTimerRef.current = window.setInterval(() => {
      const frames = rec.getElapsedFrames()
      setRecordingElapsedFrames(frames)
    }, 500)
  }, [ensureAudioEngine, ensureRecorder])

  const stopRecording = useCallback((): void => {
    const rec = recorderRef.current
    if (!rec || rec.getState() !== 'recording') return
    void rec.stop().then(({ wav }) => {
      // Browser-only download (qanun is web-only, no Electron bridge).
      const blob = new Blob([wav], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qanun-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`
      // Append to the DOM before clicking — a detached anchor's download click
      // is silently ignored in some browsers (e.g. older Firefox).
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }).catch(() => {
      // Encoding errors are surfaced via onEncoderError; nothing to do here.
    })
  }, [])

  const cancelRecording = useCallback((): void => {
    recorderRef.current?.cancel()
  }, [])

  useEffect(() => () => {
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current)
    }
    recorderRef.current?.dispose()
  }, [])

  // Derive display string for recording elapsed time from stored frame count.
  const recordingElapsedDisplay = formatElapsed(recordingElapsedFrames, sampleRate)

  return {
    recordingState,
    recordingElapsedDisplay,
    startRecording,
    stopRecording,
    cancelRecording
  }
}
