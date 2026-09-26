import { memo } from 'react'
import { lowerJinsList } from '../lib/music/sayr/lowerJins'
import type { UpperJinsOption } from '../lib/music/sayr/upperJins'
import { LOWER_JINS_KEYS, UPPER_JINS_KEYS } from '../lib/ui/keymap'

// Shared keymap tables (uppercased for display) — can't drift from the hook.
const LOWER_KEYS = LOWER_JINS_KEYS.map((k) => k.toUpperCase())
const UPPER_KEYS = UPPER_JINS_KEYS.map((k) => k.toUpperCase())

interface JinsPickerProps {
  lowerJins: string
  upperOptions: UpperJinsOption[]
  ghammazNote: string
  onLower: (id: string) => void
  onUpper: (id: string) => void
}

// The maqam builder, laid out like the keys that play it: the upper jins on
// the digit row above the lower jins on the letter row (Q–O), one column per
// family — so a column is one jins in both roles (3 = upper Hijaz, E = lower
// Hijaz). Any upper sits on any lower, except that Sikah only starts a maqam:
// its column has no upper (the cell over O stays empty, keeping the columns
// true). A dot marks the pairings that spell a named maqam (the chip's tooltip
// names it). Picking a lower jins re-anchors the home note and loads its
// customary upper. memo: prop-stable while the parent re-renders per pluck
// (upperOptions is memoized in the hook).
export const JinsPicker = memo(({ lowerJins, upperOptions, ghammazNote, onLower, onUpper }: JinsPickerProps) => (
  <div className="jins-picker">
    <div className="jins-row" role="group" aria-label={`Upper jins, on ${ghammazNote}`}>
      <span className="jins-row-label" title={`Upper jins — on the ghammāz, ${ghammazNote}. A dot marks a named maqam.`}>
        upper <span className="jins-row-note">on {ghammazNote}</span>
      </span>
      {lowerJinsList().map(({ id, label }, i) => {
        const opt = upperOptions.find((o) => o.id === id)
        return opt ? (
          <button
            key={id}
            type="button"
            className={`upper-chip${opt.active ? ' is-active' : ''}${opt.named ? ' is-named' : ''}`}
            onClick={() => onUpper(id)}
            aria-pressed={opt.active}
            aria-description={opt.maqamName}
            title={`${opt.maqamName} (${UPPER_KEYS[i]})`}
          >
            <span className="jins-key">{UPPER_KEYS[i]}</span> {opt.label}
          </button>
        ) : (
          <span key={id} className="jins-cell-empty" aria-hidden="true" title={`${label} only starts a maqam — it's never the upper jins`} />
        )
      })}
    </div>
    <div className="jins-row" role="group" aria-label="Lower jins">
      <span className="jins-row-label" title="Lower jins — sets the home note">lower</span>
      {lowerJinsList().map((j, i) => (
        <button
          key={j.id}
          type="button"
          className={`jins-chip${j.id === lowerJins ? ' is-active' : ''}`}
          onClick={() => onLower(j.id)}
          aria-pressed={j.id === lowerJins}
          title={`${j.label} (${LOWER_KEYS[i]})`}
        >
          <span className="jins-key">{LOWER_KEYS[i]}</span> {j.label}
        </button>
      ))}
    </div>
  </div>
))
