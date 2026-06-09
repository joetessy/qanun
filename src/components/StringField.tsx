import { useRef, useCallback, useEffect } from 'react'
import type { Course } from '../lib/music/types'
import {
  PLAY_FIELD_LEFT,
  PLAY_FIELD_RIGHT,
  courseScreenX,
  nearestCourse
} from '../lib/gesture/nearestCourse'
import { stageNormalizedX } from '../lib/gesture/pointerPlay'

interface StringFieldProps {
  courses: Course[]
  highlightIndex: number | null   // nearest course under a playing finger
  pluckedIndex: number | null     // course that just sounded (for feedback)
  homeDegree: number              // field degree the maqam tonic is anchored on (1/2/3)
  // Pointer play
  onPluckCourse: (index: number) => void
  onGlideCourse: (index: number) => void
  onHoldCourse: (index: number) => void
  onReleaseHold: () => void
}

const HOLD_DELAY_MS = 150

// Vertical brass strings across the play field. Each course is positioned at
// its screen x (matching nearestCourse, so visuals and hit-testing agree).
// The wrapper div captures pointer events for mouse/touch play (§2 spec).
export const StringField = ({
  courses,
  highlightIndex,
  pluckedIndex,
  homeDegree,
  onPluckCourse,
  onGlideCourse,
  onHoldCourse,
  onReleaseHold
}: StringFieldProps) => {
  const isPointerDownRef = useRef(false)
  const activeCourseRef = useRef<number | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const courseFromPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): number => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const nx = stageNormalizedX({ clientX: e.clientX, rectLeft: rect.left, rectWidth: rect.width })
      return nearestCourse({
        x: nx,
        courseCount: courses.length,
        fieldLeft: PLAY_FIELD_LEFT,
        fieldRight: PLAY_FIELD_RIGHT
      })
    },
    [courses.length]
  )

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  // Cancel any pending hold timer when the component unmounts.
  useEffect(() => () => { if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current) }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      isPointerDownRef.current = true
      const course = courseFromPointer(e)
      activeCourseRef.current = course
      onPluckCourse(course)
      holdTimerRef.current = setTimeout(() => {
        if (isPointerDownRef.current && activeCourseRef.current === course) {
          onHoldCourse(course)
        }
      }, HOLD_DELAY_MS)
    },
    [courseFromPointer, onPluckCourse, onHoldCourse]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDownRef.current) return
      const course = courseFromPointer(e)
      if (course !== activeCourseRef.current) {
        clearHoldTimer()
        activeCourseRef.current = course
        onGlideCourse(course)
      }
    },
    [courseFromPointer, onGlideCourse]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDownRef.current) return
      isPointerDownRef.current = false
      activeCourseRef.current = null
      clearHoldTimer()
      onReleaseHold()
      try {
        ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore — may already be released
      }
    },
    [onReleaseHold]
  )

  return (
    <div
      className="string-field"
      style={{ touchAction: 'none' }}
      aria-hidden
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {courses.map((c) => {
        const xPct = courseScreenX(c.index, courses.length, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT) * 100
        const classes = [
          'string',
          `degree-${c.degree}`,
          c.degree === homeDegree ? 'is-home' : '',
          c.index === highlightIndex ? 'is-highlight' : '',
          c.index === pluckedIndex ? 'is-plucked' : ''
        ].filter(Boolean).join(' ')
        return <span key={c.index} className={classes} style={{ left: `${xPct}%` }} data-degree={c.degree} />
      })}
    </div>
  )
}
