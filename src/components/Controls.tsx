import type { MandalState } from '../lib/music/types'
import type { RecorderState } from '../lib/audio/createRecorder'
import type { MidiSupportState, MidiOutputInfo } from '../lib/midi/createMidiOut'
import { TypedSelect } from './TypedSelect'
import { JINS_PAIRS, isPairActive, type JinsPair } from '../lib/music/sayr/jinsPairs'
import { midiName } from '../lib/music/midiName'

interface ControlsProps {
  tonicMidi: number
  mandalState: MandalState
  onTonic: (midi: number) => void
  onApplyPair: (pair: JinsPair) => void
  // P4a: recording
  recordingState: RecorderState
  recordingElapsedDisplay: string
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  // P4a: drone
  droneEnabled: boolean
  droneGain: number
  onDroneEnabled: (b: boolean) => void
  onDroneGain: (v: number) => void
  // P4a: metronome
  metronomeEnabled: boolean
  metronomeBpm: number
  onMetronomeEnabled: (b: boolean) => void
  onMetronomeBpm: (bpm: number) => void
  onTapMetronome: () => void
  // P4b: MIDI out
  midiEnabled: boolean
  midiSupport: MidiSupportState
  midiOutputs: readonly MidiOutputInfo[]
  midiOutputId: string | null
  midiBendRange: number
  onMidiEnabled: (b: boolean) => void
  onMidiOutputId: (id: string | null) => void
  onMidiBendRange: (semitones: number) => void
}

// 12 tonic choices, one per pitch class, anchored near the qanun's low register.
const TONICS = Array.from({ length: 12 }, (_, i) => ({
  value: String(45 + i),
  label: midiName(45 + i)
}))

const BEND_RANGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '2', label: '±2 st' },
  { value: '12', label: '±12 st' },
  { value: '24', label: '±24 st' },
  { value: '48', label: '±48 st' },
]

// Progressive disclosure (spec §1): tonic + trill ornament toggle +
// sound-source toggle + sayr/emphasis toggles + the headline jins-pair quick-swaps.
// P4a: opt-in studio section (off by default) — record/drone/metronome.
// P4b: opt-in MIDI section (off by default) — microtonal MIDI out.
export const Controls = ({
  tonicMidi,
  mandalState,
  onTonic,
  onApplyPair,
  recordingState,
  recordingElapsedDisplay,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  droneEnabled,
  droneGain,
  onDroneEnabled,
  onDroneGain,
  metronomeEnabled,
  metronomeBpm,
  onMetronomeEnabled,
  onMetronomeBpm,
  onTapMetronome,
  midiEnabled,
  midiSupport,
  midiOutputs,
  midiOutputId,
  midiBendRange,
  onMidiEnabled,
  onMidiOutputId,
  onMidiBendRange,
}: ControlsProps) => (
  <div className="controls">
    <label className="ctrl">
      <span>tonic</span>
      <TypedSelect
        value={String(tonicMidi)}
        options={TONICS}
        onChange={(v) => onTonic(Number(v))}
      />
    </label>
    <div className="quick-swaps">
      {JINS_PAIRS.map((pair) => (
        <button
          key={pair.id}
          className={`swap ${isPairActive(mandalState, pair) ? 'is-active' : ''}`}
          onClick={() => onApplyPair(pair)}
          title={`${pair.fromLabel} ↔ ${pair.toLabel}`}
        >
          {pair.fromLabel} ↔ {pair.toLabel}
        </button>
      ))}
    </div>

    {/* P4a: Studio extras — all opt-in, off by default */}
    <div className="studio-section">
      <span className="studio-label">studio</span>

      {/* Recording */}
      <div className="studio-row">
        <span className="studio-row-label">rec</span>
        {recordingState === 'idle' ? (
          <button type="button" className="studio-btn rec-start" onClick={onStartRecording}>
            record
          </button>
        ) : recordingState === 'recording' ? (
          <>
            <button type="button" className="studio-btn rec-stop" onClick={onStopRecording}>
              stop
            </button>
            <button type="button" className="studio-btn rec-cancel" onClick={onCancelRecording}>
              cancel
            </button>
            <span className="rec-elapsed">{recordingElapsedDisplay}</span>
          </>
        ) : (
          <span className="rec-elapsed">{recordingState}</span>
        )}
      </div>

      {/* Drone */}
      <div className="studio-row">
        <span className="studio-row-label">drone</span>
        <button
          type="button"
          className={`toggle ${droneEnabled ? 'is-on' : ''}`}
          onClick={() => onDroneEnabled(!droneEnabled)}
          aria-pressed={droneEnabled}
        >
          {droneEnabled ? 'on' : 'off'}
        </button>
        <input
          type="range"
          className="studio-slider"
          min={0}
          max={1}
          step={0.01}
          value={droneGain}
          onChange={(e) => onDroneGain(Number(e.target.value))}
          aria-label="drone gain"
          title={`drone gain ${Math.round(droneGain * 100)}%`}
        />
      </div>

      {/* Metronome */}
      <div className="studio-row">
        <span className="studio-row-label">metro</span>
        <button
          type="button"
          className={`toggle ${metronomeEnabled ? 'is-on' : ''}`}
          onClick={() => onMetronomeEnabled(!metronomeEnabled)}
          aria-pressed={metronomeEnabled}
        >
          {metronomeEnabled ? 'on' : 'off'}
        </button>
        <input
          type="number"
          className="studio-bpm"
          min={30}
          max={300}
          value={metronomeBpm}
          onChange={(e) => onMetronomeBpm(Number(e.target.value))}
          aria-label="metronome BPM"
        />
        <button type="button" className="studio-btn tap-btn" onClick={onTapMetronome}>
          tap
        </button>
      </div>
    </div>

    {/* P4b: MIDI out — off by default */}
    <div className="studio-section">
      <span className="studio-label">midi</span>

      <div className="studio-row">
        <span className="studio-row-label">enable</span>
        <button
          type="button"
          className={`toggle ${midiEnabled ? 'is-on' : ''}`}
          onClick={() => onMidiEnabled(!midiEnabled)}
          aria-pressed={midiEnabled}
        >
          {midiEnabled ? 'on' : 'off'}
        </button>
      </div>

      {midiSupport === 'unsupported' && (
        <div className="studio-row">
          <span className="studio-hint">Web MIDI not supported in this browser</span>
        </div>
      )}

      {midiSupport === 'denied' && (
        <div className="studio-row">
          <span className="studio-hint">MIDI access denied — check browser permissions</span>
        </div>
      )}

      {midiEnabled && midiSupport === 'ready' && (
        <>
          <div className="studio-row">
            <span className="studio-row-label">output</span>
            <select
              value={midiOutputId ?? ''}
              onChange={(e) => onMidiOutputId(e.target.value || null)}
              aria-label="MIDI output"
            >
              <option value="">— none —</option>
              {midiOutputs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="studio-row">
            <span className="studio-row-label">bend</span>
            <TypedSelect
              value={String(midiBendRange)}
              options={BEND_RANGE_OPTIONS}
              onChange={(v) => onMidiBendRange(Number(v))}
            />
          </div>
        </>
      )}
    </div>
  </div>
)
