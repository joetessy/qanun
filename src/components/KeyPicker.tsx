import { memo } from 'react'
import { FLAT_NAMES } from '../lib/music/NOTE_NAMES'
import { ACCIDENTAL_PITCH_CLASSES, KEY_TONICS } from '../lib/music/KEY_TONICS'
import { midiName } from '../lib/music/midiName'

interface KeyPickerProps {
  value: number
  onChange: (midi: number) => void
}

// The key (tonic) as a row of twelve one-tap chips, C…B, the accidentals drawn
// darker like a keyboard's black keys. Buttons, not a <select>: a dropdown
// keeps focus after you pick, and then the arrow keys and the instrument's
// letter keys retune it (type-ahead) instead of playing.
export const KeyPicker = memo(({ value, onChange }: KeyPickerProps) => (
  <div className="key-picker" role="group" aria-label="Key">
    {KEY_TONICS.map((midi, pc) => (
      <button
        key={midi}
        type="button"
        className={`key-chip${ACCIDENTAL_PITCH_CLASSES.has(pc) ? ' is-accidental' : ''}${midi === value ? ' is-active' : ''}`}
        onClick={() => onChange(midi)}
        aria-pressed={midi === value}
        title={`key of ${midiName(midi)}`}
      >
        {FLAT_NAMES[pc]}
      </button>
    ))}
  </div>
))
