import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { MandalState, Course } from '../lib/music/types'
import type { NormPoint, QanunReading, QanunStatus, RakeSensitivity } from '../types'
import { DEFAULT_RAST_STATE, cycleMandal } from '../lib/music/ajnas/MANDALS'
import { MAQAM_PRESETS } from '../lib/music/MAQAM_PRESETS'
import { buildField, DEFAULT_TONIC_MIDI } from '../lib/music/buildField'
import { identifyAjnas } from '../lib/music/identifyAjnas'
import { applyJinsPair, type JinsPair } from '../lib/music/sayr/jinsPairs'
import { nearestCourse, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from '../lib/gesture/nearestCourse'
import { upperNeighborCourse } from '../lib/gesture/pointerPlay'
import { createPluckDetector } from '../lib/gesture/detectPluck'
import { createRakeDetector } from '../lib/gesture/detectRake'
import { createMandalGesture } from '../lib/gesture/detectMandal'
import { createQanunEngine, type QanunEngine } from '../lib/audio/createQanunEngine'
import { velocityCurve } from '../lib/audio/velocityCurve'
import { createOneEuroFilter } from '../lib/oneEuro/createOneEuroFilter'
import { findHandedness } from '../lib/vision/findHandedness'
import { loadHandLandmarker } from '../lib/vision/loadHandLandmarker'
import { pinchDistance } from '../lib/vision/pinchDistance'
import { scheduleVideoFrame, type FrameHandle } from '../lib/vision/scheduleVideoFrame'
import { startCamera } from '../lib/vision/startCamera'
import { stopCamera } from '../lib/vision/stopCamera'
import { INDEX_TIP, THUMB_TIP } from '../lib/vision/constants'
import { drawFingerRing } from '../lib/draw/drawFingerRing'
import { deriveHandRoles } from './deriveHandRoles'

const READING_PUSH_EVERY_N_FRAMES = 4
// Frames a freshly plucked string stays lit before the highlight clears.
const PLUCK_GLOW_FRAMES = 6

// Overlay palette — warm bone-white rings with a soft dark halo so they read
// over the bright wood soundboard. The playing hand reads brighter than the
// modulating hand (mirrors the theremin overlay idiom).
const PLAY_RING_COLOR = 'rgba(255, 244, 214, 0.92)'
const PLUCK_RING_COLOR = 'rgba(255, 255, 255, 1)'
const MANDAL_RING_COLOR = 'rgba(226, 184, 110, 0.85)'
const OVERLAY_SHADOW = 'rgba(0, 0, 0, 0.55)'
const OVERLAY_SHADOW_BLUR = 6

export interface UseQanunEngineArgs {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export interface UseQanunEngine {
  status: QanunStatus
  errorMsg: string | null
  reading: QanunReading
  courses: Course[]
  mandalState: MandalState
  tonicMidi: number
  rakeSensitivity: RakeSensitivity
  highlightIndex: number | null
  pluckedIndex: number | null
  start: () => Promise<void>
  stop: () => void
  setTonic: (midi: number) => void
  setRakeSensitivity: (s: RakeSensitivity) => void
  cycleMandalDegree: (degree: number, direction: 1 | -1) => void
  setMandalState: (state: MandalState) => void
  setMaqamPreset: (id: string) => void
  applyPair: (pair: JinsPair) => void
  trillEnabled: boolean
  setTrillEnabled: (b: boolean) => void
  pluckCourse: (index: number) => void
  glideCourse: (index: number) => void
  holdCourse: (index: number) => void
  releaseHold: () => void
}

const EMPTY_READING: QanunReading = {
  maqamName: 'Maqam Rast',
  lowerJins: 'rast',
  upperJins: 'rast',
  tonicMidi: DEFAULT_TONIC_MIDI,
  lastPluckMidi: null
}

export const useQanunEngine = ({ videoRef, canvasRef }: UseQanunEngineArgs): UseQanunEngine => {
  const [status, setStatus] = useState<QanunStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reading, setReading] = useState<QanunReading>(EMPTY_READING)
  const [tonicMidi, setTonicMidi] = useState(DEFAULT_TONIC_MIDI)
  const [mandalState, setMandalStateRaw] = useState<MandalState>(DEFAULT_RAST_STATE)
  const [rakeSensitivity, setRakeSensitivityState] = useState<RakeSensitivity>('subtle')
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const [pluckedIndex, setPluckedIndex] = useState<number | null>(null)
  const [courses, setCourses] = useState<Course[]>(() =>
    buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
  )
  const [trillEnabled, setTrillEnabled] = useState(false)

  // Hot refs (read inside the frame loop without re-subscribing).
  const tonicRef = useRef(DEFAULT_TONIC_MIDI)
  const mandalRef = useRef<MandalState>(DEFAULT_RAST_STATE)
  const coursesRef = useRef<Course[]>(courses)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const audioRef = useRef<QanunEngine | null>(null)
  const frameHandleRef = useRef<FrameHandle | null>(null)
  const runningRef = useRef(false)
  const frameCounterRef = useRef(0)
  // Frame index at which the current pluck glow expires (cleared in tick).
  const pluckClearRef = useRef(0)
  // Tracks whether a pointer hold (rashsh) is currently active.
  const holdingRef = useRef(false)

  // One detector set per role. Two playing hands → two pluck/rake detectors.
  const pluckDetectorsRef = useRef([createPluckDetector(), createPluckDetector()])
  const rakeDetectorsRef = useRef([
    createRakeDetector({ sensitivity: 'subtle' }),
    createRakeDetector({ sensitivity: 'subtle' })
  ])
  const mandalGestureRef = useRef(createMandalGesture())
  const fingerFiltersRef = useRef([createOneEuroFilter({ minCutoff: 1.2, beta: 0.02 }), createOneEuroFilter({ minCutoff: 1.2, beta: 0.02 })])

  const recompute = useCallback((next: MandalState, nextTonic: number): void => {
    const field = buildField({ tonicMidi: nextTonic, mandalState: next })
    coursesRef.current = field
    setCourses(field)
    const id = identifyAjnas(next)
    setReading((r) => ({ ...r, maqamName: id.maqamName, lowerJins: id.lower, upperJins: id.upper, tonicMidi: nextTonic }))
  }, [])

  const setMandalAll = useCallback((next: MandalState): void => {
    mandalRef.current = next
    setMandalStateRaw(next)
    recompute(next, tonicRef.current)
  }, [recompute])

  const cycleMandalDegree = useCallback((degree: number, direction: 1 | -1): void => {
    setMandalAll(cycleMandal(mandalRef.current, degree, direction))
  }, [setMandalAll])

  const setMandalState = useCallback((state: MandalState): void => {
    setMandalAll(state)
  }, [setMandalAll])

  const setMaqamPreset = useCallback((id: string): void => {
    const preset = MAQAM_PRESETS.find((p) => p.id === id)
    if (preset) setMandalAll(preset.mandalState)
  }, [setMandalAll])

  const applyPair = useCallback((pair: JinsPair): void => {
    setMandalAll(applyJinsPair(mandalRef.current, pair))
  }, [setMandalAll])

  const setTonic = useCallback((midi: number): void => {
    tonicRef.current = midi
    setTonicMidi(midi)
    recompute(mandalRef.current, midi)
  }, [recompute])

  const setRakeSensitivity = useCallback((s: RakeSensitivity): void => {
    setRakeSensitivityState(s)
    rakeDetectorsRef.current.forEach((d) => d.setSensitivity(s))
  }, [])

  /** Lazily creates + starts the audio engine on first user interaction. */
  const ensureAudioEngine = useCallback(async (): Promise<void> => {
    if (!audioRef.current) audioRef.current = createQanunEngine({ polyphony: 16 })
    if (!audioRef.current.isStarted) await audioRef.current.start()
  }, [])

  // ── Pointer play primitives ─────────────────────────────────────────────────
  // These work without the webcam — ensureAudioEngine() handles lazy audio init.

  const POINTER_VELOCITY = 0.7

  const pluckCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndex(index)
      setPluckedIndex(index)
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
      if (trillEnabled) {
        const neighborIdx = upperNeighborCourse(index, field.length)
        audio.trill({
          freqHz: field[index].freqHz,
          neighborHz: field[neighborIdx].freqHz,
          velocity: POINTER_VELOCITY
        })
      } else {
        audio.pluck({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY })
      }
    })
  }, [ensureAudioEngine, trillEnabled])

  const glideCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndex(index)
      setPluckedIndex(index)
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
      audio.pluck({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY })
    })
  }, [ensureAudioEngine])

  const holdCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndex(index)
      holdingRef.current = true
      audio.holdStart({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY })
    })
  }, [ensureAudioEngine])

  const releaseHold = useCallback((): void => {
    if (!holdingRef.current) return
    holdingRef.current = false
    audioRef.current?.holdStop()
  }, [])

  const tick = useCallback((): void => {
    if (!runningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    const audio = audioRef.current
    const scheduleNext = (): void => {
      if (!runningRef.current || !video) return
      // Re-arm the next frame; tick recurses through scheduleVideoFrame's callback.
      // The ref write runs in a frame callback (not during render), so the
      // immutability rule's render-mutation concern doesn't apply.
      // eslint-disable-next-line react-hooks/immutability
      frameHandleRef.current = scheduleVideoFrame({ video, callback: tick })
    }
    if (!video || !canvas || !landmarker || !audio || video.readyState < 2) {
      scheduleNext()
      return
    }

    let result
    try {
      result = landmarker.detectForVideo(video, performance.now())
    } catch {
      scheduleNext()
      return
    }

    const tNow = performance.now() / 1000
    const { rightHandIdx, leftHandIdx } = findHandedness({ result })
    // Mirror x to screen space (0 = screen-left). Left hand's index tip x.
    const leftHandX = leftHandIdx !== -1 ? 1 - result.landmarks[leftHandIdx][INDEX_TIP].x : 1
    const { playHands, mandalHandIdx } = deriveHandRoles({ rightHandIdx, leftHandIdx, leftHandX })
    const field = coursesRef.current

    // Fingertips to draw this frame, collected during detection and rendered
    // AFTER the audio path so canvas work never delays a pluck.
    let mandalTip: NormPoint | null = null
    const playTips: NormPoint[] = []

    // --- Mandal hand ---
    if (mandalHandIdx !== null) {
      const lm = result.landmarks[mandalHandIdx]
      const tip = lm[INDEX_TIP]
      mandalTip = tip
      const ev = mandalGestureRef.current.update({
        x: 1 - tip.x,
        y: tip.y,
        pinchDist: pinchDistance({ a: tip, b: lm[THUMB_TIP] }),
        tNow
      })
      if (ev) setMandalAll(cycleMandal(mandalRef.current, ev.degree, ev.direction))
    } else {
      mandalGestureRef.current.reset()
    }

    // --- Playing hands ---
    let lastPluckMidi: number | null = null
    let primaryCourse: number | null = null
    let pluckedCourse: number | null = null
    playHands.forEach((handIdx, slot) => {
      if (slot > 1) return // two-slot pool
      const lm = result.landmarks[handIdx]
      const tip = lm[INDEX_TIP]
      playTips.push(tip)
      const screenX = fingerFiltersRef.current[slot].filter({ x: 1 - tip.x, tNow })
      const course = nearestCourse({
        x: screenX,
        courseCount: field.length,
        fieldLeft: PLAY_FIELD_LEFT,
        fieldRight: PLAY_FIELD_RIGHT
      })
      // Slot 0 is the primary playing hand — the string it hovers is highlighted.
      if (slot === 0) primaryCourse = course
      // Pinch pluck (precise).
      const pluck = pluckDetectorsRef.current[slot].update({
        pinchDist: pinchDistance({ a: tip, b: lm[THUMB_TIP] }),
        courseIndex: course,
        tNow
      })
      if (pluck && field[pluck.courseIndex]) {
        audio.pluck({ freqHz: field[pluck.courseIndex].freqHz, velocity: pluck.velocity })
        lastPluckMidi = field[pluck.courseIndex].midi
        pluckedCourse = pluck.courseIndex
      }
      // Rake (glissando).
      const raked = rakeDetectorsRef.current[slot].update({ courseIndex: course, tNow })
      for (const c of raked) {
        if (field[c]) {
          audio.pluck({ freqHz: field[c].freqHz, velocity: velocityCurve(0.7) })
          lastPluckMidi = field[c].midi
          pluckedCourse = c
        }
      }
    })

    frameCounterRef.current += 1
    if (lastPluckMidi !== null || frameCounterRef.current % READING_PUSH_EVERY_N_FRAMES === 0) {
      setReading((r) => ({ ...r, lastPluckMidi: lastPluckMidi ?? r.lastPluckMidi }))
    }

    // --- String highlight / pluck feedback (state for StringField) ---
    setHighlightIndex(primaryCourse)
    if (pluckedCourse !== null) {
      setPluckedIndex(pluckedCourse)
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
    } else if (frameCounterRef.current >= pluckClearRef.current) {
      setPluckedIndex(null)
    }

    // --- Overlay drawing (finger rings) ---
    // Reuses lib/draw exactly like useThereminEngine.tick: clear, draw a halo'd
    // ring per tracked fingertip, mirror=true. Strictly after the audio path so
    // it never blocks a pluck.
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.shadowColor = OVERLAY_SHADOW
      ctx.shadowBlur = OVERLAY_SHADOW_BLUR
      // Modulating (mandal) hand: a calmer brass ring.
      if (mandalTip) {
        drawFingerRing({ ctx, tip: mandalTip, width: w, height: h, mirror: true, color: MANDAL_RING_COLOR, radius: 13, lineWidth: 2 })
      }
      // Playing hands: bright rings; a thicker, white ring on the frame a string sounds.
      const pluckedThisFrame = pluckedCourse !== null
      playTips.forEach((tip, slot) => {
        const isPrimary = slot === 0
        drawFingerRing({
          ctx,
          tip,
          width: w,
          height: h,
          mirror: true,
          color: isPrimary && pluckedThisFrame ? PLUCK_RING_COLOR : PLAY_RING_COLOR,
          radius: isPrimary && pluckedThisFrame ? 17 : 14,
          lineWidth: isPrimary && pluckedThisFrame ? 3 : 2.25
        })
      })
      // Reset shadow so the next frame's clearRect / draws aren't haloed twice.
      ctx.shadowColor = 'rgba(0, 0, 0, 0)'
      ctx.shadowBlur = 0
    }

    scheduleNext()
  }, [videoRef, canvasRef, setMandalAll])

  const start = useCallback(async (): Promise<void> => {
    if (status === 'running' || status === 'loading') return
    setErrorMsg(null)
    setStatus('loading')
    try {
      await ensureAudioEngine()
      if (!landmarkerRef.current) landmarkerRef.current = await loadHandLandmarker()
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) throw new Error('Video/canvas element missing')
      const { width, height } = await startCamera({ video })
      canvas.width = width
      canvas.height = height
      pluckDetectorsRef.current.forEach((d) => d.reset())
      rakeDetectorsRef.current.forEach((d) => d.reset())
      mandalGestureRef.current.reset()
      fingerFiltersRef.current.forEach((f) => f.reset())
      frameCounterRef.current = 0
      pluckClearRef.current = 0
      setHighlightIndex(null)
      setPluckedIndex(null)
      runningRef.current = true
      setStatus('running')
      frameHandleRef.current = scheduleVideoFrame({ video, callback: tick })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [status, videoRef, canvasRef, tick, ensureAudioEngine])

  const stop = useCallback((): void => {
    runningRef.current = false
    frameHandleRef.current?.cancel()
    frameHandleRef.current = null
    stopCamera({ video: videoRef.current })
    // Reset gesture state, symmetric with start(), so a Stop→Start cycle doesn't
    // inherit a stale One-Euro timestamp (which would spike the derivative and
    // misfire on the first frame back).
    pluckDetectorsRef.current.forEach((d) => d.reset())
    rakeDetectorsRef.current.forEach((d) => d.reset())
    mandalGestureRef.current.reset()
    fingerFiltersRef.current.forEach((f) => f.reset())
    // Clear any lingering overlay ring and the string highlight/pluck glow.
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHighlightIndex(null)
    setPluckedIndex(null)
    setStatus('idle')
  }, [videoRef, canvasRef])

  // Release renderer-side resources on unmount: the audio graph and the
  // MediaPipe landmarker's WASM. Both are lazily rebuilt on the next start().
  useEffect(
    () => () => {
      audioRef.current?.dispose()
      landmarkerRef.current?.close()
    },
    []
  )

  return {
    status,
    errorMsg,
    reading,
    courses,
    mandalState,
    tonicMidi,
    rakeSensitivity,
    highlightIndex,
    pluckedIndex,
    start,
    stop,
    setTonic,
    setRakeSensitivity,
    cycleMandalDegree,
    setMandalState,
    setMaqamPreset,
    applyPair,
    trillEnabled,
    setTrillEnabled,
    pluckCourse,
    glideCourse,
    holdCourse,
    releaseHold
  }
}
