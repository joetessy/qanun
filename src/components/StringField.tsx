import { useRef, useCallback, useEffect } from 'react'
import type { Course } from '../lib/music/types'
import {
  PLAY_FIELD_LEFT,
  PLAY_FIELD_RIGHT,
  courseScreenX,
  nearestCourse
} from '../lib/gesture/nearestCourse'
import { stageNormalizedX } from '../lib/gesture/pointerPlay'
import { createVibrato } from '../lib/gesture/vibrato'

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
  onVibrato: (cents: number, rateHz: number) => void
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
  onReleaseHold,
  onVibrato
}: StringFieldProps) => {
  const isPointerDownRef = useRef(false)
  const activeCourseRef = useRef<number | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mouse vibrato: once the hold becomes a sustain, vertical drag drives the
  // detector (parity with the camera path). Kept minimal — feeds clientY / vh.
  const sustainingRef = useRef(false)
  const vibratoRef = useRef(createVibrato())

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
      sustainingRef.current = false
      const course = courseFromPointer(e)
      activeCourseRef.current = course
      onPluckCourse(course)
      holdTimerRef.current = setTimeout(() => {
        if (isPointerDownRef.current && activeCourseRef.current === course) {
          onHoldCourse(course)
          // Sustain is now live — vertical drag starts driving vibrato.
          sustainingRef.current = true
          vibratoRef.current.reset()
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
      // While sustaining, vertical drag drives vibrato (course is by x, so this
      // never switches strings). Normalize clientY against the viewport height.
      if (sustainingRef.current) {
        const y = e.clientY / window.innerHeight
        const { cents, rateHz } = vibratoRef.current.update({
          y,
          tNow: performance.now() / 1000,
          active: true
        })
        onVibrato(cents, rateHz)
      }
    },
    [courseFromPointer, onGlideCourse, onVibrato]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerDownRef.current) return
      isPointerDownRef.current = false
      activeCourseRef.current = null
      clearHoldTimer()
      onReleaseHold()
      // Drop any vibrato when the pointer lifts.
      if (sustainingRef.current) {
        sustainingRef.current = false
        vibratoRef.current.reset()
        onVibrato(0, 0)
      }
      try {
        ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore — may already be released
      }
    },
    [onReleaseHold, onVibrato]
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
