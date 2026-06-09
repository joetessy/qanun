import type { MandalState } from '../lib/music/types'
import { MANDAL_DEGREES, offsetOf } from '../lib/music/ajnas/MANDALS'
import { degreeNoteLabel, NATURAL_OFFSETS } from '../lib/music/degreeLabel'

interface MandalRackProps {
  mandalState: MandalState
  tonicMidi: number
  activeDegree: number | null                      // lever under the left hand
  onCycle: (degree: number, direction: 1 | -1) => void
}

// Degrees that are the "workhorses" of maqam modulation — subtly emphasised.
const WORKHORSE_DEGREES = new Set([3, 7])

export const MandalRack = ({ mandalState, tonicMidi, activeDegree, onCycle }: MandalRackProps) => (
  <div className="mandal-rack">
    <span className="rack-label">mandal</span>
    {[...MANDAL_DEGREES].reverse().map((md) => {
      const current = offsetOf(mandalState, md.degree)
      const isAltered = current !== NATURAL_OFFSETS[md.degree - 1]
      const isWorkhorse = WORKHORSE_DEGREES.has(md.degree)
      const label = degreeNoteLabel({ tonicMidi, degree: md.degree, offset: current })

      return (
        <div
          key={md.degree}
          className={[
            'lever',
            `degree-${md.degree}`,
            activeDegree === md.degree ? 'is-active' : '',
            md.fixed ? 'is-fixed' : '',
            isAltered ? 'is-altered' : '',
            isWorkhorse ? 'is-workhorse' : '',
          ].filter(Boolean).join(' ')}
        >
          <button
            className="up"
            disabled={md.fixed}
            onClick={() => onCycle(md.degree, 1)}
            aria-label={`raise degree ${md.degree}`}
          >▲</button>

          {/* Lever body — click cycles up (same as ▲ button). */}
          <button
            className="lever-body"
            disabled={md.fixed}
            onClick={() => onCycle(md.degree, 1)}
            aria-label={`cycle degree ${md.degree}`}
          >
            <span className="lever-label">{label}</span>
          </button>

          <button
            className="down"
            disabled={md.fixed}
            onClick={() => onCycle(md.degree, -1)}
            aria-label={`lower degree ${md.degree}`}
          >▼</button>
        </div>
      )
    })}
  </div>
)
