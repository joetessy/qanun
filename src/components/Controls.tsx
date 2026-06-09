import type { MandalState } from '../lib/music/types'
import type { RakeSensitivity } from '../types'
import type { SoundSource } from '../lib/audio/createQanunEngine'
import { TypedSelect } from './TypedSelect'
import { JINS_PAIRS, isPairActive, type JinsPair } from '../lib/music/sayr/jinsPairs'
import { midiName } from '../lib/music/midiName'

interface ControlsProps {
  tonicMidi: number
  rakeSensitivity: RakeSensitivity
  mandalState: MandalState
  trillEnabled: boolean
  soundSource: SoundSource
  isSampleLoaded: boolean
  showEmphasis: boolean
  showSayrGuide: boolean
  onTonic: (midi: number) => void
  onRakeSensitivity: (s: RakeSensitivity) => void
  onApplyPair: (pair: JinsPair) => void
  onTrillEnabled: (b: boolean) => void
  onSoundSource: (s: SoundSource) => void
  onShowEmphasis: (b: boolean) => void
  onShowSayrGuide: (b: boolean) => void
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
// sound-source toggle + sayr/emphasis toggles + the headline jins-pair quick-swaps.
export const Controls = ({
  tonicMidi,
  rakeSensitivity,
  mandalState,
  trillEnabled,
  soundSource,
  isSampleLoaded,
  showEmphasis,
  showSayrGuide,
  onTonic,
  onRakeSensitivity,
  onApplyPair,
  onTrillEnabled,
  onSoundSource,
  onShowEmphasis,
  onShowSayrGuide,
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
    <label className="ctrl">
      <span>sound</span>
      <button
        type="button"
        className={`toggle ${soundSource === 'sample' ? 'is-on' : ''}`}
        onClick={() => onSoundSource(soundSource === 'sample' ? 'synth' : 'sample')}
        aria-pressed={soundSource === 'sample'}
        title={soundSource === 'sample' && !isSampleLoaded ? 'loading samples…' : undefined}
      >
        {soundSource === 'sample'
          ? (isSampleLoaded ? 'sample' : 'sample…')
          : 'synth'}
      </button>
    </label>
    <label className="ctrl">
      <span>emphasis</span>
      <button
        type="button"
        className={`toggle ${showEmphasis ? 'is-on' : ''}`}
        onClick={() => onShowEmphasis(!showEmphasis)}
        aria-pressed={showEmphasis}
        title="Highlight tonic, ghammaz, octave, and leading-tone strings"
      >
        {showEmphasis ? 'on' : 'off'}
      </button>
    </label>
    <label className="ctrl">
      <span>sayr</span>
      <button
        type="button"
        className={`toggle ${showSayrGuide ? 'is-on' : ''}`}
        onClick={() => onShowSayrGuide(!showSayrGuide)}
        aria-pressed={showSayrGuide}
        title="Show idiomatic next-move suggestions"
      >
        {showSayrGuide ? 'on' : 'off'}
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
