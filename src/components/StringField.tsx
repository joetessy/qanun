import type { Course } from '../lib/music/types'
import { PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT, courseScreenX } from '../lib/gesture/nearestCourse'

interface StringFieldProps {
  courses: Course[]
  highlightIndex: number | null   // nearest course under a playing finger
  pluckedIndex: number | null     // course that just sounded (for feedback)
}

// Vertical brass strings across the play field. Each course is positioned at
// its screen x (matching nearestCourse, so visuals and hit-testing agree).
export const StringField = ({ courses, highlightIndex, pluckedIndex }: StringFieldProps) => (
  <div className="string-field" aria-hidden>
    {courses.map((c) => {
      const xPct = courseScreenX(c.index, courses.length, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT) * 100
      const classes = [
        'string',
        `degree-${c.degree}`,
        c.degree === 1 ? 'is-tonic' : '',
        c.index === highlightIndex ? 'is-highlight' : '',
        c.index === pluckedIndex ? 'is-plucked' : ''
      ].filter(Boolean).join(' ')
      return <span key={c.index} className={classes} style={{ left: `${xPct}%` }} data-degree={c.degree} />
    })}
  </div>
)
