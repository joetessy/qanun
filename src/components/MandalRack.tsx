import type { MandalState } from '../lib/music/types'
import { MANDAL_DEGREES, offsetOf } from '../lib/music/ajnas/MANDALS'

interface MandalRackProps {
  mandalState: MandalState
  activeDegree: number | null                     // lever under the left hand
  onCycle: (degree: number, direction: 1 | -1) => void
}

// Seven stacked levers (degree 7 at the top → degree 1 at the bottom, matching
// mandalLeverFromY). Each shows its current position within the degree's set.
// Click affordances mirror the flick gesture so the rack is usable without a camera.
export const MandalRack = ({ mandalState, activeDegree, onCycle }: MandalRackProps) => (
  <div className="mandal-rack">
    {[...MANDAL_DEGREES].reverse().map((md) => {
      const current = offsetOf(mandalState, md.degree)
      const posIndex = md.positions.indexOf(current)
      return (
        <div
          key={md.degree}
          className={`lever degree-${md.degree} ${activeDegree === md.degree ? 'is-active' : ''} ${md.fixed ? 'is-fixed' : ''}`}
        >
          <button className="up" disabled={md.fixed} onClick={() => onCycle(md.degree, 1)} aria-label={`raise degree ${md.degree}`}>▲</button>
          <span className="pos" data-degree={md.degree}>
            {md.positions.map((p, i) => (
              <span key={p} className={`tick ${i === posIndex ? 'on' : ''}`} />
            ))}
          </span>
          <button className="down" disabled={md.fixed} onClick={() => onCycle(md.degree, -1)} aria-label={`lower degree ${md.degree}`}>▼</button>
        </div>
      )
    })}
  </div>
)
