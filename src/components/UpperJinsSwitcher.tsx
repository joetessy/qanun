import type { UpperJinsOption } from '../lib/music/sayr/upperJins'

interface UpperJinsSwitcherProps {
  options: UpperJinsOption[]
  ghammazLabel: string | null
  onSelect: (id: string) => void
}

const KEYS = ['1', '2', '3', '4', '5']

export const UpperJinsSwitcher = ({ options, ghammazLabel, onSelect }: UpperJinsSwitcherProps) => {
  if (options.length === 0) return null
  return (
    <div className="upper-jins-switcher" role="group" aria-label="Upper jins (on the ghammāz)">
      <span className="upper-jins-label">
        upper jins
        {ghammazLabel && <span className="upper-jins-ghammaz"> on {ghammazLabel}</span>}
      </span>
      <div className="upper-jins-chips">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            className={`upper-chip ${opt.active ? 'is-active' : ''}`}
            onClick={() => onSelect(opt.id)}
            aria-pressed={opt.active}
            title={opt.maqamName}
          >
            {i < KEYS.length && <span className="jins-key">{KEYS[i]}</span>} {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
