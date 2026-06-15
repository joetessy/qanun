interface CameraNoticeProps {
  reason: string | null
  onRetry: () => void
  onDismiss: () => void
}

// Shown in the 'no-camera' state: the webcam was denied/unavailable, but the
// instrument is fully playable by mouse + keyboard. Deliberately non-blocking —
// the wrapper passes pointer events through to the strings underneath; only the
// buttons catch clicks (see .camera-notice in App.css).
export const CameraNotice = ({ reason, onRetry, onDismiss }: CameraNoticeProps) => (
  <div className="camera-notice" role="status">
    <div className="camera-notice-body">
      <strong>Playing without the camera</strong>
      <span>{reason ? `${reason} — ` : ''}use your mouse or the keyboard to play.</span>
    </div>
    <div className="camera-notice-actions">
      <button type="button" className="camera-notice-retry" onClick={onRetry}>
        retry camera
      </button>
      <button
        type="button"
        className="camera-notice-dismiss"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  </div>
)
