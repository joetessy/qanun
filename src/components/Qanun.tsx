import { useRef, useState, useCallback } from 'react'
import { Stage } from './Stage'
import { StageCover } from './StageCover'
import { StringField } from './StringField'
import { LowerJinsSelector } from './LowerJinsSelector'
import { UpperJinsSwitcher } from './UpperJinsSwitcher'
import { MandalRail } from './MandalRail'
import { QanunHud } from './QanunHud'
import { Controls } from './Controls'
import { Rosette } from './Rosette'
import { Onboarding } from './Onboarding'
import { useQanunEngine } from '../hooks/useQanunEngine'
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
        {/* Modulation controls inline in the header: Jins mode shows the lower-jins
            (Q–O) rail first, then the upper-jins (1–5) — the family anchors the
            maqam, the upper modulates on top of it; Qanun mode swaps in the mandal
            levers. */}
        <div className="jins-bar">
          {engine.modMode === 'jins' ? (
            <div className="jins-bar-body">
              <LowerJinsSelector lowerJins={engine.lowerJins} onSelect={engine.setLowerJins} />
              <UpperJinsSwitcher
                options={engine.upperJinsOptions}
                ghammazLabel={engine.ghammazLabel}
                onSelect={engine.setUpperJins}
              />
            </div>
          ) : (
            <div className="jins-bar-body">
              <div className="mandal-rail-row">
                <MandalRail
                  mandalState={engine.mandalState}
                  tonicMidi={engine.tonicMidi}
                  onSetMandal={engine.setMandalAt}
                  onStep={engine.stepMandal}
                  expanded={leversExpanded}
                  onToggleExpand={toggleLevers}
                />
                <button
                  type="button"
                  className="levers-toggle"
                  aria-expanded={leversExpanded}
                  onClick={toggleLevers}
                  title={leversExpanded ? 'Show only the set note' : 'Show all positions'}
                >
                  {leversExpanded ? 'collapse ▴' : 'expand ▾'}
                </button>
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
