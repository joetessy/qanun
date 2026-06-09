import type { MandalState } from '../lib/music/types'
import { MAQAM_PRESETS } from '../lib/music/MAQAM_PRESETS'

interface MaqamPresetsProps {
  mandalState: MandalState
  onSelectPreset: (id: string) => void
  onReset: () => void
}

// Deep-equality check for MandalState arrays.
const statesEqual = (a: MandalState, b: MandalState): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

// Short display name: strip "Maqam " prefix for the chip label.
const shortName = (name: string): string => name.replace(/^Maqam\s+/i, '')

export const MaqamPresets = ({ mandalState, onSelectPreset, onReset }: MaqamPresetsProps) => {
  const activeId = MAQAM_PRESETS.find((p) => statesEqual(p.mandalState, mandalState))?.id ?? null

  return (
    <div className="maqam-presets" role="group" aria-label="Maqam presets">
      <span className="presets-label">maqam</span>
      <div className="preset-chips">
        {MAQAM_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset-chip ${activeId === p.id ? 'is-active' : ''}`}
            onClick={() => onSelectPreset(p.id)}
            aria-pressed={activeId === p.id}
            title={p.name}
          >
            {shortName(p.name)}
          </button>
        ))}
        <button
          type="button"
          className="preset-chip preset-reset"
          onClick={onReset}
          aria-label="Reset to Maqam Rast"
          title="Reset to Rast"
        >
          ↺
        </button>
      </div>
    </div>
  )
}
