import { memo } from 'react'
import type { RecorderState } from '../lib/audio/createRecorder'
import type { MidiSupportState, MidiOutputInfo } from '../lib/midi/createMidiOut'
import type { ModMode } from '../hooks/useQanunEngine'
import { TypedSelect } from './TypedSelect'
import { midiName } from '../lib/music/midiName'
import { DETUNE_LIMIT_CENTS } from '../lib/music/buildField'
import { formatCents } from '../lib/ui/formatCents'
import { DEFAULT_TREMOLO_HZ, TREMOLO_HZ_MIN, TREMOLO_HZ_MAX } from '../lib/audio/tremolo'
import { BPM_MIN, BPM_MAX, clamp } from '../lib/practice/tapTempo'

interface ControlsProps {
  // Qanun mode has no fixed tonic (you root wherever you play), so the tonic
  // selector is hidden there.
  modMode: ModMode
  tonicMidi: number
  onTonic: (midi: number) => void
  // Global fine-tune (cents), −DETUNE_LIMIT_CENTS…+DETUNE_LIMIT_CENTS.
  detuneCents: number
  onDetuneCents: (cents: number) => void
  // Tremolo pulse (Hz), shared by single- and two-note holds.
  tremoloHz: number
  onTremoloHz: (hz: number) => void
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

// 12 tonic choices, one per pitch class, anchored around the C4 default tonic.
const TONICS = Array.from({ length: 12 }, (_, i) => ({
  value: String(57 + i),
  label: midiName(57 + i)
}))

const BEND_RANGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '2', label: '±2 st' },
  { value: '12', label: '±12 st' },
  { value: '24', label: '±24 st' },
  { value: '48', label: '±48 st' },
]

// Progressive disclosure (spec §1): tonic + fine-tune.
// P4a: opt-in studio section (off by default) — record/drone/metronome.
// P4b: opt-in MIDI section (off by default) — microtonal MIDI out.
// memo: the drawer stays mounted (hidden) while the engine pushes per-pluck
// state, so without it the ~60-element tree re-renders on every pluck.
export const Controls = memo(({
  modMode,
  tonicMidi,
  onTonic,
  detuneCents,
  onDetuneCents,
  tremoloHz,
  onTremoloHz,
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
    {modMode !== 'qanun' && (
      <label className="ctrl">
        <span>tonic</span>
        <TypedSelect
          value={String(tonicMidi)}
          options={TONICS}
          onChange={(v) => onTonic(Number(v))}
        />
      </label>
    )}
    {/* Fine-tune: a master detune in cents, ± a semitone. Slider + click-to-reset
        readout. Shifts the whole instrument's pitch without renaming any note. */}
    <div className="ctrl">
      <span>fine</span>
      <input
        type="range"
        className="studio-slider"
        min={-DETUNE_LIMIT_CENTS}
        max={DETUNE_LIMIT_CENTS}
        step={1}
        value={detuneCents}
        onChange={(e) => onDetuneCents(Number(e.target.value))}
        aria-label="fine tune in cents"
        title={`fine tune ${formatCents(detuneCents)}`}
      />
      <button
        type="button"
        className="detune-readout"
        onClick={() => onDetuneCents(0)}
        title="reset fine tune to 0"
        aria-label={`fine tune ${formatCents(detuneCents)}, click to reset`}
      >
        {formatCents(detuneCents)}
      </button>
    </div>
    {/* Tremolo pulse: one rate for both hold shapes (single-note rashsh and the
        two-note trill — they alternate at the same pulse, so their relationship
        never changes). Click the readout to reset to the default. */}
    <div className="ctrl">
      <span>trem</span>
      <input
        type="range"
        className="studio-slider"
        min={TREMOLO_HZ_MIN}
        max={TREMOLO_HZ_MAX}
        step={0.5}
        value={tremoloHz}
        onChange={(e) => onTremoloHz(Number(e.target.value))}
        aria-label="tremolo speed in strikes per second"
        title={`tremolo ${tremoloHz} strikes/s`}
      />
      <button
        type="button"
        className="detune-readout"
        onClick={() => onTremoloHz(DEFAULT_TREMOLO_HZ)}
        title={`reset tremolo to ${DEFAULT_TREMOLO_HZ}/s`}
        aria-label={`tremolo ${tremoloHz} strikes per second, click to reset`}
      >
        {tremoloHz}/s
      </button>
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
            {/* is-live adds the pulsing red dot — only while actually recording,
                not for the transient encoding/saving readouts below. */}
            <span className="rec-elapsed is-live">{recordingElapsedDisplay}</span>
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
          min={BPM_MIN}
          max={BPM_MAX}
          value={metronomeBpm}
          onChange={(e) => onMetronomeBpm(Number(e.target.value))}
          // While typing, out-of-range intermediates are allowed (the engine
          // clamps internally); on blur the display snaps to the real range so
          // it can't sit at e.g. 0 while the metronome actually ticks at 30.
          onBlur={(e) => onMetronomeBpm(clamp(Number(e.target.value) || BPM_MIN, BPM_MIN, BPM_MAX))}
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
))
