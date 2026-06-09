import type { QanunReading } from '../types'
import { midiName } from '../lib/music/midiName'

interface QanunHudProps {
  reading: QanunReading
}

// One-line live readout (spec §1 progressive disclosure: this is all that's
// shown by default besides the instrument and your hands).
export const QanunHud = ({ reading }: QanunHudProps) => (
  <div className="readout">
    <div className="cell maqam">
      <span className="k">maqam</span>
      <span className="v">{reading.maqamName}</span>
    </div>
    <div className="cell">
      <span className="k">home</span>
      <span className="v">{reading.homeNote.toLowerCase()}</span>
    </div>
    <div className="cell">
      <span className="k">last</span>
      <span className="v">{reading.lastPluckMidi !== null ? midiName(reading.lastPluckMidi).toLowerCase() : '—'}</span>
    </div>
  </div>
)
