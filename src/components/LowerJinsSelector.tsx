import { memo } from 'react'
import { lowerJinsList } from '../lib/music/sayr/lowerJins'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

interface LowerJinsSelectorProps {
  lowerJins: string
  onSelect: (id: string) => void
}

// The lower-jins rail — replaces the old maqam-preset rail. Picking a family
// re-anchors the home tonic to that jins's conventional degree (Bayati→D, etc.).
// Keys 1–9 select the families in order (mirrored in the hook). memo: prop-stable
// while the parent re-renders per pluck.
export const LowerJinsSelector = memo(({ lowerJins, onSelect }: LowerJinsSelectorProps) => (
  <div className="jins-selector" role="group" aria-label="Lower jins">
    <span className="jins-selector-label">jins</span>
    <div className="jins-chips">
      {lowerJinsList().map((j, i) => (
        <button
          key={j.id}
          type="button"
          className={`jins-chip ${j.id === lowerJins ? 'is-active' : ''}`}
          onClick={() => onSelect(j.id)}
          aria-pressed={j.id === lowerJins}
          title={`${j.label} (${KEYS[i]})`}
        >
          <span className="jins-key">{KEYS[i]}</span> {j.label}
        </button>
      ))}
    </div>
  </div>
))
