import type { QanunReading } from '../types'
import type { ModMode } from '../hooks/useQanunEngine'
import { midiName } from '../lib/music/midiName'

interface QanunHudProps {
  reading: QanunReading
  modMode: ModMode
}

// One-line live readout (spec §1 progressive disclosure: this is all that's
// shown by default besides the instrument and your hands). Qanun mode has no
// fixed home/maqam (you root wherever you play), so it drops both the maqam and
// home cells, leaving just the last-plucked note; Jins mode shows all three.
export const QanunHud = ({ reading, modMode }: QanunHudProps) => (
  <div className="readout">
    {modMode !== 'qanun' && (
      <div className="cell maqam">
        <span className="k">maqam</span>
        <span className="v" title={reading.maqamName}>{reading.maqamName}</span>
      </div>
    )}
    {modMode !== 'qanun' && (
      <div className="cell">
        <span className="k">home</span>
        <span className="v">{reading.homeNote.toLowerCase()}</span>
      </div>
    )}
    <div className="cell">
      <span className="k">last</span>
      <span className="v">{reading.lastPluckMidi !== null ? midiName(reading.lastPluckMidi).toLowerCase() : '—'}</span>
    </div>
  </div>
)
