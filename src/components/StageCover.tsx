import type { QanunStatus } from '../types'

interface StageCoverProps {
  status: QanunStatus
  errorMsg: string | null
  onStart: () => void
}

// Zero-config entry: a single "play" affordance. Tone.js + camera both require
// a user gesture, so the first tap unlocks audio and requests the webcam.
export const StageCover = ({ status, errorMsg, onStart }: StageCoverProps) => {
  // Lift the cover once the instrument is playable: with the camera ('running')
  // or without it ('no-camera', mouse + keyboard). 'error' is a hard, mute
  // failure (audio couldn't start), so it keeps the blocking retry cover.
  if (status === 'running' || status === 'no-camera') return null
  return (
    <div className="stage-cover">
      {status === 'loading' && <span className="spinner">loading…</span>}
      {status === 'error' && (
        <div className="error">
          <strong>couldn't start</strong>
          <span>{errorMsg}</span>
        </div>
      )}
      {(status === 'idle' || status === 'error') && (
        <button className="primary" onClick={onStart}>
          play
        </button>
      )}
    </div>
  )
}
