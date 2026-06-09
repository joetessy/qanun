import { useEffect, useCallback } from 'react'

interface OnboardingProps {
  onDismiss: () => void
}

// First-run guide overlay — inlaid into the soundboard like an engraved instruction card.
// Dismiss on the close button, on Escape, or on click of the scrim.
export const Onboarding = ({ onDismiss }: OnboardingProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    },
    [onDismiss],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    // Clicking the scrim (not the card) also dismisses
    <div className="onboarding-scrim" role="dialog" aria-modal="true" aria-label="How to play" onClick={onDismiss}>
      <div
        className="onboarding-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="onboarding-grain" aria-hidden />

        <header className="onboarding-head">
          <span className="onboarding-title">how to play</span>
        </header>

        <ol className="onboarding-steps">
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>1</span>
            <div className="step-body">
              <strong>play</strong>
              <span>
                Click a string to pluck — drag across to glide, hold to sustain.
                Or press <em>play</em> to use your hands: pinch to pluck, hold the
                pinch to sustain, and wave up &amp; down to add vibrato.
              </span>
            </div>
          </li>
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>2</span>
            <div className="step-body">
              <strong>choose a maqam</strong>
              <span>
                Pick a <em>lower jins</em> (the chips, or keys <em>Q&ndash;O</em>) to
                set the home note, then an <em>upper jins</em> (keys <em>1&ndash;5</em>)
                to modulate on the ghammāz. The readout names the maqam you build.
              </span>
            </div>
          </li>
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>3</span>
            <div className="step-body">
              <strong>tools</strong>
              <span>
                Open <em>tune</em> (top-right) to set the key, record a take, or turn
                on the drone, metronome, and MIDI out.
              </span>
            </div>
          </li>
        </ol>

        <div className="onboarding-foot">
          <button
            type="button"
            className="onboarding-dismiss"
            onClick={onDismiss}
            autoFocus
          >
            begin
          </button>
          <span className="onboarding-esc">or press Esc</span>
        </div>
      </div>
    </div>
  )
}
