// SayrGuide: opt-in panel showing idiomatic next modulation moves.
// Off by default — shown only when showSayrGuide=true.
import type { SayrMove } from '../lib/music/sayr/SAYR_NETWORKS'
import type { JinsPair } from '../lib/music/sayr/jinsPairs'

interface SayrGuideProps {
  maqamName: string
  suggestions: SayrMove[]
  onApplyPreset: (id: string) => void
  onApplyPair: (pair: JinsPair) => void
  jinsPairs: readonly JinsPair[]
}

const RELATIONSHIP_TAG: Record<string, string> = {
  'upper-jins':    'upper',
  'shared-ghammaz':'ghammaz',
  'jins-pair':     'pair',
  'tonic-recolor': 'recolor',
}

export const SayrGuide = ({
  maqamName,
  suggestions,
  onApplyPreset,
  onApplyPair,
  jinsPairs,
}: SayrGuideProps) => {
  const handleClick = (move: SayrMove) => {
    if (move.apply.kind === 'preset') {
      onApplyPreset(move.apply.id)
    } else {
      const pair = jinsPairs.find((p) => p.id === move.apply.id)
      if (pair) onApplyPair(pair)
    }
  }

  return (
    <div className="sayr-guide" aria-label="Sayr guide — idiomatic next moves">
      <div className="sayr-guide-header">
        <span className="sayr-guide-label">sayr</span>
        <span className="sayr-guide-maqam">{maqamName}</span>
      </div>
      <div className="sayr-guide-chips">
        {suggestions.length === 0 ? (
          <span className="sayr-guide-empty">no moves available</span>
        ) : (
          suggestions.map((move, i) => (
            <button
              key={i}
              type="button"
              className="sayr-chip"
              onClick={() => handleClick(move)}
              title={move.relationship}
            >
              <span className="sayr-chip-label">{move.label}</span>
              <span className="sayr-chip-tag">{RELATIONSHIP_TAG[move.relationship] ?? move.relationship}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
