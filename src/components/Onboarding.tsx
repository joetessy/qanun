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
        <header className="onboarding-head">
          <span className="onboarding-title">how to play</span>
        </header>

        <ol className="onboarding-steps">
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>1</span>
            <div className="step-body">
              <strong>pluck &amp; strum</strong>
              <span>
                Press <em>play</em> for your hands. Strings run left&ndash;right, low at
                the bottom: move your hand <em>up or down</em> to pick one, then pinch
                your <em>index</em> finger to the thumb to pluck it. Sweep up and down
                across the strings to strum. No camera? Click a string to pluck, or drag
                up or down to strum. Or play from the keyboard: <em>A&ndash;L</em> run
                up the scale, <em>Z</em> / <em>X</em> drop or raise the octave.
              </span>
            </div>
          </li>
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>2</span>
            <div className="step-body">
              <strong>trill</strong>
              <span>
                Pinch your <em>middle</em> finger to the thumb to trill that string;
                slide to move the trill. Hold a string with <em>both hands</em> an
                octave apart for a high&ndash;low trill. (With the mouse, hold a string.)
              </span>
            </div>
          </li>
          <li className="onboarding-step">
            <span className="step-num" aria-hidden>3</span>
            <div className="step-body">
              <strong>choose a maqam</strong>
              <span>
                Pick a <em>lower jins</em> (the chips, or keys <em>Q&ndash;O</em>) to
                set the home note, then an <em>upper jins</em> (keys <em>1&ndash;5</em>)
                to modulate on the ghammāz. The readout names the maqam you build.
                Or press <em>M</em> for <em>qanun</em> mode and raise / lower each
                note with two key rows (<em>Q&ndash;U</em> raise, <em>1&ndash;7</em> lower).
                Open <em>tune</em> for the key, recording, drone, metronome &amp; MIDI.
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
