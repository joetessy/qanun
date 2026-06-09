import type { QanunStatus } from '../types'

interface StageCoverProps {
  status: QanunStatus
  errorMsg: string | null
  onStart: () => void
}

// Zero-config entry: a single "play" affordance. Tone.js + camera both require
// a user gesture, so the first tap unlocks audio and requests the webcam.
export const StageCover = ({ status, errorMsg, onStart }: StageCoverProps) => {
  if (status === 'running') return null
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
