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
                Click a string to pluck; drag across strings to glide; hold for
                sustain. Press <em>play</em> to use your hands over the webcam.
              </span>
            </div>
          </li>
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>2</span>
            <div className="step-body">
              <strong>modulate</strong>
              <span>
                Tap the <em>mandal switches</em> on the left to retune a scale
                degree, or tap a <em>maqam preset</em> chip along the bottom rail to
                jump to a maqam.
              </span>
            </div>
          </li>
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>3</span>
            <div className="step-body">
              <strong>ornament &amp; tools</strong>
              <span>
                Open <em>tune</em> in the top-right for tonic, trill, Sample/Synth
                voice, sayr guide, recording, drone, metronome, and MIDI.
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
