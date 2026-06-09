import type { MandalState } from '../lib/music/types'
import type { RakeSensitivity } from '../types'
import { TypedSelect } from './TypedSelect'
import { JINS_PAIRS, isPairActive, type JinsPair } from '../lib/music/sayr/jinsPairs'
import { midiName } from '../lib/music/midiName'

interface ControlsProps {
  tonicMidi: number
  rakeSensitivity: RakeSensitivity
  mandalState: MandalState
  trillEnabled: boolean
  onTonic: (midi: number) => void
  onRakeSensitivity: (s: RakeSensitivity) => void
  onApplyPair: (pair: JinsPair) => void
  onTrillEnabled: (b: boolean) => void
}

// 12 tonic choices, one per pitch class, anchored near the qanun's low register.
const TONICS = Array.from({ length: 12 }, (_, i) => ({
  value: String(45 + i),
  label: midiName(45 + i)
}))

const RAKE_OPTIONS: ReadonlyArray<{ value: RakeSensitivity; label: string }> = [
  { value: 'off', label: 'rake: off' },
  { value: 'subtle', label: 'rake: subtle' },
  { value: 'full', label: 'rake: full' }
]

// Progressive disclosure (spec §1): tonic + rake + trill ornament toggle +
// the headline jins-pair quick-swaps. Everything deeper (sayr guide, FX, MIDI)
// is later phases.
export const Controls = ({
  tonicMidi,
  rakeSensitivity,
  mandalState,
  trillEnabled,
  onTonic,
  onRakeSensitivity,
  onApplyPair,
  onTrillEnabled
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
    <label className="ctrl">
      <span>rake</span>
      <TypedSelect value={rakeSensitivity} options={RAKE_OPTIONS} onChange={onRakeSensitivity} />
    </label>
    <label className="ctrl">
      <span>trill</span>
      <button
        type="button"
        className={`toggle ${trillEnabled ? 'is-on' : ''}`}
        onClick={() => onTrillEnabled(!trillEnabled)}
        aria-pressed={trillEnabled}
      >
        {trillEnabled ? 'on' : 'off'}
      </button>
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
  </div>
)
