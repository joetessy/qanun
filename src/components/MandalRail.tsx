import { memo } from 'react'
import { MANDAL_DEGREES, offsetOf } from '../lib/music/ajnas/MANDALS'
import { degreeNoteLabel } from '../lib/music/degreeLabel'
import { QANUN_LOWER_KEYS, QANUN_RAISE_KEYS } from '../lib/ui/keymap'
import type { MandalState } from '../lib/music/types'

// Widest position set across the degrees — when expanded, shorter levers pad with
// spacers at the top so the highest pitch of every column lines up along the bottom.
const SLOTS = Math.max(...MANDAL_DEGREES.map((d) => d.positions.length))
// Two directional key rows, one note per column: top key lowers, bottom raises.
// Shared keymap tables (uppercased for display) so labels can't drift from the
// engine's keydown handler.
const RAISE_KEYS = QANUN_RAISE_KEYS.map((k) => k.toUpperCase())
const LOWER_KEYS = QANUN_LOWER_KEYS.map((k) => k.toUpperCase())

// Split a note label into its letter + accidental and tag the accidental, so CSS
// can pull in the ♭/♯ glyphs' right-side bearing — otherwise an accidental note
// (E½♭, F♯, …) renders ~1.5px left of centre even though its box is centred.
const NoteLabel = ({ label }: { label: string }) => {
  const i = label.search(/[^A-G]/)
  return i <= 0 ? <>{label}</> : <>{label.slice(0, i)}<span className="note-acc">{label.slice(i)}</span></>
}

interface MandalRailProps {
  mandalState: MandalState
  tonicMidi: number
  onSetMandal: (degree: number, offset: number) => void
  onStep: (degree: number, dir: 1 | -1) => void
  // Collapsed (false) shows just the set note per course; expanded shows the full
  // position stack. Owned by the parent (toggled from the header).
  expanded: boolean
  onToggleExpand: () => void
}

// Qanun-mode levers (the ʿurab). One column per note course, capped by its two
// directional keys — lower on top, raise below (Q–U raise C..B, 1–7 lower; hold to
// glide). Collapsed by default to just the SET note per course (click it, or the
// header toggle, to reveal the full position stack — click a slot to jump there).
// Labels track the tonic. No home — you root wherever you play. memo: parent
// re-renders per pluck; this only depends on tuning + tonic + expand state.
export const MandalRail = memo(({ mandalState, tonicMidi, onSetMandal, onStep, expanded, onToggleExpand }: MandalRailProps) => (
  <div className="mandal-rail" role="group" aria-label="Levers — per-note tuning">
    {MANDAL_DEGREES.map(({ degree, positions }) => {
      const current = offsetOf(mandalState, degree)
      const currentLabel = degreeNoteLabel({ tonicMidi, degree, offset: current })
      return (
        <div className="mandal-col" key={degree}>
          <button
            type="button"
            className="mandal-step mandal-lower"
            onClick={() => onStep(degree, -1)}
            aria-label={`Lower degree ${degree}`}
            title={`lower a quarter-tone (${LOWER_KEYS[degree - 1]}; hold key to glide)`}
          >
            ↓ {LOWER_KEYS[degree - 1]}
          </button>
          {expanded ? (
            <div className="mandal-slots">
              {Array.from({ length: SLOTS - positions.length }).map((_, i) => (
                <span key={`sp${i}`} className="mandal-slot is-spacer" aria-hidden />
              ))}
              {positions.map((offset) => {
                const active = offset === current
                const label = degreeNoteLabel({ tonicMidi, degree, offset })
                return (
                  <button
                    key={offset}
                    type="button"
                    className={`mandal-slot ${active ? 'is-active' : ''}`}
                    onClick={() => onSetMandal(degree, offset)}
                    aria-pressed={active}
                    title={label}
                  >
                    <NoteLabel label={label} />
                  </button>
                )
              })}
            </div>
          ) : (
            <button
              type="button"
              className="mandal-slot is-active mandal-current"
              onClick={onToggleExpand}
              title={`${currentLabel} — show all positions`}
            >
              <NoteLabel label={currentLabel} />
            </button>
          )}
          <button
            type="button"
            className="mandal-step mandal-raise"
            onClick={() => onStep(degree, 1)}
            aria-label={`Raise degree ${degree}`}
            title={`raise a quarter-tone (${RAISE_KEYS[degree - 1]}; hold key to glide)`}
          >
            ↑ {RAISE_KEYS[degree - 1]}
          </button>
        </div>
      )
    })}
  </div>
))
