// MaqamReadout: compact always-visible strip beneath the jins switchers.
// Shows the current maqam name + home note, plus up to 4 sayr suggestion chips
// that apply a move on click (using the same apply path as SayrGuide).
import type { SayrMove } from '../lib/music/sayr/SAYR_NETWORKS'
import type { JinsPair } from '../lib/music/sayr/jinsPairs'

interface MaqamReadoutProps {
  maqamName: string
  homeNote: string
  suggestions: SayrMove[]
  jinsPairs: readonly JinsPair[]
  onApplyPreset: (id: string) => void
  onApplyPair: (pair: JinsPair) => void
}

export const MaqamReadout = ({
  maqamName,
  homeNote,
  suggestions,
  jinsPairs,
  onApplyPreset,
  onApplyPair,
}: MaqamReadoutProps) => {
  const handleClick = (move: SayrMove) => {
    if (move.apply.kind === 'preset') {
      onApplyPreset(move.apply.id)
    } else {
      const pair = jinsPairs.find((p) => p.id === move.apply.id)
      if (pair) onApplyPair(pair)
    }
  }

  return (
    <div className="maqam-readout" aria-label="Current maqam and sayr suggestions">
      <span className="mr-maqam">{maqamName}</span>
      <span className="mr-home">home {homeNote.toLowerCase()}</span>
      {suggestions.length > 0 && (
        <span className="mr-sayr">
          {suggestions.slice(0, 4).map((move, i) => (
            <button
              key={i}
              type="button"
              className="mr-move"
              onClick={() => handleClick(move)}
              title={move.relationship}
            >
              → {move.label}
            </button>
          ))}
        </span>
      )}
    </div>
  )
}
