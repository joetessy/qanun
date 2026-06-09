import type { MandalState } from '../lib/music/types'
import { identifyAjnas } from '../lib/music/identifyAjnas'
import { jinsById } from '../lib/music/ajnas/JINS'
import { degreeNoteLabel } from '../lib/music/degreeLabel'
import { upperOptions } from '../lib/music/sayr/upperJins'

interface UpperJinsSwitcherProps {
  mandalState: MandalState
  tonicMidi: number
  onApplyUpper: (id: string) => void
}

// The ghammāz note label for the current state — tells the player which scale
// degree the upper jins is rooted on (e.g. "G" for Rast on C, "F" for Bayati).
const ghammazLabel = (mandalState: MandalState, tonicMidi: number): string | null => {
  const { lower } = identifyAjnas(mandalState)
  if (!lower) return null
  const jins = jinsById(lower)
  const g = jins.ghammazDegree
  const offset = mandalState[g - 1]
  return degreeNoteLabel({ tonicMidi, degree: g, offset })
}

export const UpperJinsSwitcher = ({ mandalState, tonicMidi, onApplyUpper }: UpperJinsSwitcherProps) => {
  const options = upperOptions(mandalState)
  const ghLabel = ghammazLabel(mandalState, tonicMidi)

  // No options when the current scale has no identifiable lower jins — hide
  // gracefully rather than rendering an empty strip.
  if (options.length === 0) return null

  return (
    <div className="upper-jins-switcher" role="group" aria-label="Upper jins (on the ghammāz)">
      <span className="upper-jins-label">
        upper jins
        {ghLabel && <span className="upper-jins-ghammaz"> on {ghLabel}</span>}
      </span>
      <div className="upper-jins-chips">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`upper-chip ${opt.active ? 'is-active' : ''}`}
            onClick={() => onApplyUpper(opt.id)}
            aria-pressed={opt.active}
            title={opt.maqamName}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
