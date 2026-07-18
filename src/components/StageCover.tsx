import { useState } from 'react'
import type { QanunStatus } from '../types'

interface StageCoverProps {
  status: QanunStatus
  errorMsg: string | null
  onStart: () => void
  onStartWithoutCamera: () => void
}

// Zero-config entry: a single "play" affordance. Tone.js + camera both require
// a user gesture, so the first tap unlocks audio and requests the webcam. A
// quieter secondary path starts audio-only for players who don't want the
// camera prompt at all.
export const StageCover = ({ status, errorMsg, onStart, onStartWithoutCamera }: StageCoverProps) => {
  // The no-camera notice is dismissible; reset the dismissal whenever the
  // status leaves 'no-camera' so a later failed retry surfaces it again.
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  if (status !== 'no-camera' && noticeDismissed) setNoticeDismissed(false)
  // The instrument is fully playable without the camera ('no-camera', mouse +
  // keyboard) — no blocking cover, but a camera denial/failure must not be
  // silent: surface the reason in a small dismissible corner notice with a
  // retry (start() is re-entrant from 'no-camera').
  if (status === 'no-camera') {
    if (!errorMsg || noticeDismissed) return null
    return (
      <div className="camera-notice" role="status">
        <span className="camera-notice-msg">{errorMsg} — playing without hand tracking</span>
        <button type="button" className="camera-notice-retry" onClick={onStart}>
          retry camera
        </button>
        <button
          type="button"
          className="camera-notice-dismiss"
          aria-label="Dismiss camera notice"
          onClick={() => setNoticeDismissed(true)}
        >
          ×
        </button>
      </div>
    )
  }
  // Lift the cover once the camera runs. 'error' is a hard, mute failure
  // (audio couldn't start), so it keeps the blocking retry cover.
  if (status === 'running') return null
  return (
    <div className="stage-cover">
      {status === 'loading' && (
        <>
          <span className="spinner">loading…</span>
          <span className="cover-hint">starting up — allow camera access if your browser asks</span>
        </>
      )}
      {status === 'error' && (
        <div className="error">
          <strong>couldn't start</strong>
          <span>{errorMsg}</span>
        </div>
      )}
      {(status === 'idle' || status === 'error') && (
        <>
          <button className="primary" onClick={onStart}>
            play
          </button>
          <button type="button" className="cover-no-camera" onClick={onStartWithoutCamera}>
            or play without the camera
          </button>
        </>
      )}
    </div>
  )
}
