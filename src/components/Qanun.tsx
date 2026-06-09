import { useRef, useState } from 'react'
import { Stage } from './Stage'
import { StageCover } from './StageCover'
import { StringField } from './StringField'
import { MandalRack } from './MandalRack'
import { QanunHud } from './QanunHud'
import { CameraInset } from './CameraInset'
import { Controls } from './Controls'
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

        {/* Soundboard overlays — painted chrome layered over the camera/canvas. */}
        <MandalRack
          mandalState={engine.mandalState}
          activeDegree={null}
          onCycle={engine.cycleMandalDegree}
        />
        <StringField
          courses={engine.courses}
          highlightIndex={engine.highlightIndex}
          pluckedIndex={engine.pluckedIndex}
        />
        <CameraInset enabled={engine.status === 'running'} />
      </div>

      <div id="qanun-controls" className={`controls-drawer ${controlsOpen ? 'is-open' : ''}`} hidden={!controlsOpen}>
        <Controls
          tonicMidi={engine.tonicMidi}
          rakeSensitivity={engine.rakeSensitivity}
          mandalState={engine.mandalState}
          onTonic={engine.setTonic}
          onRakeSensitivity={engine.setRakeSensitivity}
          onApplyPair={engine.applyPair}
        />
      </div>
    </div>
  )
}
