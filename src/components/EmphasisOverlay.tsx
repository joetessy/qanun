// EmphasisOverlay: glows the emphasis-note course positions over the string field.
// Off by default — layered in Qanun.tsx above StringField when showEmphasis=true.
// Uses courseScreenX from nearestCourse (same geometry as StringField).
import type { Course } from '../lib/music/types'
import type { EmphasisNotes } from '../lib/music/sayr/emphasisNotes'
import {
  PLAY_FIELD_LEFT,
  PLAY_FIELD_RIGHT,
  courseScreenX,
} from '../lib/gesture/nearestCourse'

interface EmphasisOverlayProps {
  courses: Course[]
  emphasis: EmphasisNotes
}

interface GlowEntry {
  index: number
  tier: 'strong' | 'medium' | 'light'
}

export const EmphasisOverlay = ({ courses, emphasis }: EmphasisOverlayProps) => {
  // Build a map of index → highest tier for that course.
  const glowMap = new Map<number, GlowEntry['tier']>()

  const set = (idx: number, tier: GlowEntry['tier']) => {
    const current = glowMap.get(idx)
    // priority: strong > medium > light
    if (!current || tier === 'strong' || (tier === 'medium' && current === 'light')) {
      glowMap.set(idx, tier)
    }
  }

  for (const idx of emphasis.tonic)       set(idx, 'strong')
  for (const idx of emphasis.ghammaz)     set(idx, 'strong')
  for (const idx of emphasis.octave)      set(idx, 'medium')
  for (const idx of emphasis.leadingTone) set(idx, 'light')

  return (
    <div className="emphasis-overlay" aria-hidden>
      {courses.map((c) => {
        const tier = glowMap.get(c.index)
        if (!tier) return null
        const xPct = courseScreenX(c.index, courses.length, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT) * 100
        return (
          <span
            key={c.index}
            className={`emphasis-glow emphasis-${tier}`}
            style={{ left: `${xPct}%` }}
            data-degree={c.degree}
          />
        )
      })}
    </div>
  )
}
