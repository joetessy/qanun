import { useRef, useState, useCallback } from 'react'
import { Stage } from './Stage'
import { StageCover } from './StageCover'
import { StringField } from './StringField'
import { JinsPicker } from './JinsPicker'
import { MandalRail } from './MandalRail'
import { QanunHud } from './QanunHud'
import { Controls } from './Controls'
import { Rosette } from './Rosette'
import { Onboarding } from './Onboarding'
import { useQanunEngine } from '../hooks/useQanunEngine'
import { isNaturalState } from '../lib/music/ajnas/isNaturalState'
import { courseNoteName } from '../lib/music/courseNoteName'
import { hasOnboarded, setOnboarded } from '../lib/ui/onboardingStorage'

// The instrument. Composes the camera stage, the painted soundboard overlays
// (string field, mandal rack, camera PIP), the one-line HUD, and the opt-in
// controls drawer. All data + behaviour come from useQanunEngine; this file is
// pure composition + the progressive-disclosure shell (spec §1, §7).
export const Qanun = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engine = useQanunEngine({ videoRef, canvasRef })
  // Controls stay tucked away by default — the surface is just the instrument,
  // your hands, and the readout until you open the drawer.
  const [controlsOpen, setControlsOpen] = useState(false)
  // Qanun mode: the lever rail is collapsed to just the set note per course by
  // default; this header toggle expands it to the full position stacks. Lifted
  // here so it persists across rail re-renders and sits with the right-side
  // controls. The toggle is a stable callback — an inline arrow here would break
  // MandalRail's memo and re-render all ~60 rail buttons on every pluck.
  const [leversExpanded, setLeversExpanded] = useState(false)
  const toggleLevers = useCallback(() => setLeversExpanded((v) => !v), [])

  // Onboarding: show on first visit; persist dismissal in localStorage.
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded())
  const dismissOnboarding = useCallback(() => {
    setOnboarded()
    setShowOnboarding(false)
  }, [])
  const reopenOnboarding = useCallback(() => setShowOnboarding(true), [])

  // Nothing to reset while every lever already rests on its natural.
  const leversAtNatural = isNaturalState(engine.mandalState)
  // The string window's end notes for the range control, e.g. "G3" – "D6".
  const fieldLow = engine.courses[0]
  const fieldHigh = engine.courses[engine.courses.length - 1]

  return (
    <div className="qanun">
      <header className="qanun-header">
        <span className="wordmark">qanun</span>
        {/* Mode switch pinned right by the wordmark (before the readout) so it keeps
            a fixed spot and doesn't shift when the bar's contents change on switch. */}
        <button
          type="button"
          className="mode-toggle"
          onClick={() => engine.setModMode(engine.modMode === 'qanun' ? 'jins' : 'qanun')}
          aria-label={`Modulation mode: ${engine.modMode}. Switch with M.`}
          title="Switch modulation mode (M)"
        >
          <span className={engine.modMode === 'jins' ? 'is-active' : ''}>jins</span>
          <span className={engine.modMode === 'qanun' ? 'is-active' : ''}>qanun</span>
        </button>
        <QanunHud reading={engine.reading} modMode={engine.modMode} />
        {/* Modulation controls inline in the header, each laid out like the keys
            that drive it: Jins mode stacks the upper jins (digits 1–9) over the
            lower jins (Q–O), one column per family; Qanun mode swaps in the
            mandal levers (1–7 lower over Q–U raise). */}
        <div className="jins-bar">
          {engine.modMode === 'jins' ? (
            <div className="jins-bar-body">
              <JinsPicker
                lowerJins={engine.lowerJins}
                upperOptions={engine.upperJinsOptions}
                ghammazNote={engine.ghammazNote}
                onLower={engine.setLowerJins}
                onUpper={engine.setUpperJins}
              />
            </div>
          ) : (
            <div className="jins-bar-body">
              <div className="mandal-rail-row">
                <MandalRail
                  mandalState={engine.mandalState}
                  tonicMidi={engine.fieldTonicMidi}
                  onSetMandal={engine.setMandalAt}
                  onStep={engine.stepMandal}
                  expanded={leversExpanded}
                  onToggleExpand={toggleLevers}
                />
                <div className="levers-actions">
                  <button
                    type="button"
                    className="levers-toggle"
                    aria-expanded={leversExpanded}
                    onClick={toggleLevers}
                    title={leversExpanded ? 'Show only the set note' : 'Show all positions'}
                  >
                    {leversExpanded ? 'collapse ▴' : 'expand ▾'}
                  </button>
                  {/* aria-disabled, not disabled: a disabled button drops the
                      keyboard focus it had the moment it resets the levers. */}
                  <button
                    type="button"
                    className="levers-toggle levers-reset"
                    onClick={engine.resetMandals}
                    aria-disabled={leversAtNatural}
                    title={leversAtNatural ? 'Every lever is natural' : 'Every lever back to natural — C D E F G A B (0)'}
                  >
                    <span className="jins-key">0</span> naturals
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Camera toggle: turn a running webcam off, or (re)start hand tracking —
            doubling as the retry affordance from the no-camera notice. stop()
            returns to the idle play cover (there's no camera-less "keep playing"
            transition from running today). Hidden while loading/error so it can't
            race an in-flight start. */}
        {(engine.status === 'running' || engine.status === 'idle' || engine.status === 'no-camera') && (
          <button
            type="button"
            className="controls-toggle"
            aria-label={engine.status === 'running' ? 'Turn the camera off' : 'Turn the camera on'}
            onClick={engine.status === 'running' ? engine.stop : () => { void engine.start() }}
          >
            {engine.status === 'running' ? 'cam off' : 'cam on'}
          </button>
        )}
        <button
          type="button"
          className="help-btn"
          aria-label="How to play"
          title="How to play"
          onClick={reopenOnboarding}
        >
          ?
        </button>
        <a
          className="contact-btn"
          href="mailto:yusuftwinfish@gmail.com?subject=Qanun"
          aria-label="Contact by email"
          title="Contact"
        >
          ✉
        </a>
        <button
          type="button"
          className={`controls-toggle ${controlsOpen ? 'is-open' : ''}`}
          aria-expanded={controlsOpen}
          aria-controls="qanun-controls"
          onClick={() => setControlsOpen((open) => !open)}
        >
          {controlsOpen ? 'close' : 'tune'}
        </button>
      </header>

      <div className={`soundboard${engine.handTracking ? ' is-tracking' : ''}`}>
        <Stage
          videoRef={videoRef}
          canvasRef={canvasRef}
          status={engine.status}
        />

        {/* Inlaid sound-hole rosettes — painted onto the wood beneath the strings. */}
        <div className="rosettes" aria-hidden>
          <Rosette className="rosette-major" />
          <Rosette className="rosette-minor" />
        </div>

        <StringField
          courses={engine.courses}
          highlightIndices={engine.highlightIndices}
          pluckedIndices={engine.pluckedIndices}
          homeDegree={engine.modMode === 'qanun' ? 0 : engine.homeDegree}
          ghammazDegree={engine.modMode === 'qanun' ? 0 : engine.ghammazDegree}
          landmarkDegree={engine.modMode === 'qanun' ? 1 : 0}
          onPluckCourse={engine.pluckCourse}
          onGlideCourse={engine.glideCourse}
          onHoldCourse={engine.holdCourse}
          onReleaseHold={engine.releaseHold}
        />
        {/* Play / start cover — a direct soundboard child so it sits ABOVE the
            strings (z-index), keeping the play button clickable. Self-hides when running. */}
        <StageCover
          status={engine.status}
          errorMsg={engine.errorMsg}
          onStart={engine.start}
          onStartWithoutCamera={engine.startWithoutCamera}
        />
        {/* First-run onboarding guide — overlaid above everything, dismissible. */}
        {showOnboarding && <Onboarding onDismiss={dismissOnboarding} />}
      </div>

      {/* inert (not `hidden`) while closed: the drawer collapses via max-height,
          which hides it visually but left its controls keyboard-focusable — Tab
          could land on invisible sliders. inert also drops it from the a11y tree. */}
      <div id="qanun-controls" className={`controls-drawer ${controlsOpen ? 'is-open' : ''}`} inert={!controlsOpen}>
        <Controls
          modMode={engine.modMode}
          tonicMidi={engine.tonicMidi}
          onTonic={engine.setTonic}
          detuneCents={engine.detuneCents}
          onDetuneCents={engine.setDetuneCents}
          fieldRange={engine.fieldRange}
          rangeLowLabel={courseNoteName({ course: fieldLow, tonicMidi: engine.fieldTonicMidi })}
          rangeHighLabel={courseNoteName({ course: fieldHigh, tonicMidi: engine.fieldTonicMidi })}
          onRangeEnd={engine.setFieldRangeEnd}
          onRangeReset={engine.resetFieldRange}
          tremoloHz={engine.tremoloHz}
          onTremoloHz={engine.setTremoloHz}
          recordingState={engine.recordingState}
          recordingElapsedDisplay={engine.recordingElapsedDisplay}
          onStartRecording={engine.startRecording}
          onStopRecording={engine.stopRecording}
          onCancelRecording={engine.cancelRecording}
          droneEnabled={engine.droneEnabled}
          droneGain={engine.droneGain}
          onDroneEnabled={engine.setDroneEnabled}
          onDroneGain={engine.setDroneGain}
          metronomeEnabled={engine.metronomeEnabled}
          metronomeBpm={engine.metronomeBpm}
          onMetronomeEnabled={engine.setMetronomeEnabled}
          onMetronomeBpm={engine.setMetronomeBpm}
          onTapMetronome={engine.tapMetronome}
          midiEnabled={engine.midiEnabled}
          midiSupport={engine.midiSupport}
          midiOutputs={engine.midiOutputs}
          midiOutputId={engine.midiOutputId}
          midiBendRange={engine.midiBendRange}
          onMidiEnabled={engine.setMidiEnabled}
          onMidiOutputId={engine.setMidiOutputId}
          onMidiBendRange={engine.setMidiBendRange}
        />
      </div>
    </div>
  )
}
