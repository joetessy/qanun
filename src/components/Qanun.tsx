import { useRef, useState } from 'react'
import { Stage } from './Stage'
import { StageCover } from './StageCover'
import { StringField } from './StringField'
import { MandalRack } from './MandalRack'
import { MaqamPresets } from './MaqamPresets'
import { QanunHud } from './QanunHud'
import { CameraInset } from './CameraInset'
import { Controls } from './Controls'
import { Rosette } from './Rosette'
import { SayrGuide } from './SayrGuide'
import { EmphasisOverlay } from './EmphasisOverlay'
import { JINS_PAIRS } from '../lib/music/sayr/jinsPairs'
import { useQanunEngine } from '../hooks/useQanunEngine'

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

  return (
    <div className="qanun">
      <header className="qanun-header">
        <span className="wordmark">qanun</span>
        <QanunHud reading={engine.reading} />
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

      <div className="soundboard">
        <Stage
          videoRef={videoRef}
          canvasRef={canvasRef}
          status={engine.status}
          cover={<StageCover status={engine.status} errorMsg={engine.errorMsg} onStart={engine.start} />}
        />

        {/* Inlaid sound-hole rosettes — painted onto the wood beneath the strings. */}
        <div className="rosettes" aria-hidden>
          <Rosette className="rosette-major" />
          <Rosette className="rosette-minor" />
        </div>

        {/* Modulation panel — always visible (spec §1 keyboard-style switches). */}
        <MandalRack
          mandalState={engine.mandalState}
          tonicMidi={engine.tonicMidi}
          activeDegree={null}
          onCycle={engine.cycleMandalDegree}
        />
        <MaqamPresets
          mandalState={engine.mandalState}
          onSelectPreset={engine.setMaqamPreset}
          onReset={() => engine.setMaqamPreset('rast')}
        />
        <StringField
          courses={engine.courses}
          highlightIndex={engine.highlightIndex}
          pluckedIndex={engine.pluckedIndex}
          onPluckCourse={engine.pluckCourse}
          onGlideCourse={engine.glideCourse}
          onHoldCourse={engine.holdCourse}
          onReleaseHold={engine.releaseHold}
        />
        {/* Emphasis overlay — off by default, layered above strings. */}
        {engine.showEmphasis && (
          <EmphasisOverlay courses={engine.courses} emphasis={engine.emphasis} />
        )}
        {/* Sayr guide — off by default, positioned above the preset rail. */}
        {engine.showSayrGuide && (
          <SayrGuide
            maqamName={engine.reading.maqamName}
            suggestions={engine.suggestions}
            onApplyPreset={engine.setMaqamPreset}
            onApplyPair={engine.applyPair}
            jinsPairs={JINS_PAIRS}
          />
        )}
        <CameraInset enabled={engine.status === 'running'} />
      </div>

      <div id="qanun-controls" className={`controls-drawer ${controlsOpen ? 'is-open' : ''}`} hidden={!controlsOpen}>
        <Controls
          tonicMidi={engine.tonicMidi}
          rakeSensitivity={engine.rakeSensitivity}
          mandalState={engine.mandalState}
          trillEnabled={engine.trillEnabled}
          soundSource={engine.soundSource}
          isSampleLoaded={engine.isSampleLoaded}
          showEmphasis={engine.showEmphasis}
          showSayrGuide={engine.showSayrGuide}
          onTonic={engine.setTonic}
          onRakeSensitivity={engine.setRakeSensitivity}
          onApplyPair={engine.applyPair}
          onTrillEnabled={engine.setTrillEnabled}
          onSoundSource={engine.setSoundSource}
          onShowEmphasis={engine.setShowEmphasis}
          onShowSayrGuide={engine.setShowSayrGuide}
        />
      </div>
    </div>
  )
}
