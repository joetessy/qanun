import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { MandalState, Course } from '../lib/music/types'
import type { NormPoint, QanunReading, QanunStatus } from '../types'
import { DEFAULT_RAST_STATE, offsetOf } from '../lib/music/ajnas/MANDALS'
import { MAQAM_PRESETS } from '../lib/music/MAQAM_PRESETS'
import { buildField, DEFAULT_TONIC_MIDI } from '../lib/music/buildField'
import { identifyAjnas } from '../lib/music/identifyAjnas'
import { degreeNoteLabel } from '../lib/music/degreeLabel'
import { applyLowerJins, lowerJinsById, lowerJinsList, maqamNameFor } from '../lib/music/sayr/lowerJins'
import { applyUpperJins, upperOptions, ghammazFieldDegree, type UpperJinsOption } from '../lib/music/sayr/upperJins'
import { nearestCourse, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from '../lib/gesture/nearestCourse'
import { createPinchPlay } from '../lib/gesture/pinchPlay'
import { createVibrato } from '../lib/gesture/vibrato'
import { createQanunEngine, type QanunEngine } from '../lib/audio/createQanunEngine'
import { createRecorder, type Recorder, type RecorderState } from '../lib/audio/createRecorder'
import { formatElapsed } from '../lib/audio/formatElapsed'
import { createDrone, type DroneEngine } from '../lib/practice/createDrone'
import { createMetronome, type MetronomeEngine } from '../lib/practice/createMetronome'
import { createMidiOut, type MidiOutEngine, type MidiSupportState, type MidiOutputInfo } from '../lib/midi/createMidiOut'
import { createOneEuroFilter } from '../lib/oneEuro/createOneEuroFilter'
import { findHandedness } from '../lib/vision/findHandedness'
import { loadHandLandmarker } from '../lib/vision/loadHandLandmarker'
import { pinchDistance } from '../lib/vision/pinchDistance'
import { scheduleVideoFrame, type FrameHandle } from '../lib/vision/scheduleVideoFrame'
import { startCamera } from '../lib/vision/startCamera'
import { stopCamera } from '../lib/vision/stopCamera'
import { INDEX_TIP, THUMB_TIP } from '../lib/vision/constants'
import { projectPoint } from '../lib/draw/projectPoint'
import { deriveHandRoles } from './deriveHandRoles'

const READING_PUSH_EVERY_N_FRAMES = 4
// Frames a freshly plucked string stays lit before the highlight clears.
const PLUCK_GLOW_FRAMES = 6
// Velocity for a sustained (rashsh) note when the per-frame reconcile (re)starts it.
const SUSTAIN_VELOCITY = 0.6

// Overlay palette — warm bone-white rings with a soft dark halo so they read
// over the bright wood soundboard. The playing hand reads brighter than the
// modulating hand (mirrors the theremin overlay idiom).
const PLAY_RING_COLOR = 'rgba(255, 244, 214, 0.92)'
const PLUCK_RING_COLOR = 'rgba(255, 255, 255, 1)'
// Pinch distance below which a fingertip shows "pressed" feedback (tighter ring + filled dot).
const PINCH_VISUAL_THRESHOLD = 0.05
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
  highlightIndices: number[]
  pluckedIndices: number[]
  start: () => Promise<void>
  stop: () => void
  setTonic: (midi: number) => void
  setMandalState: (state: MandalState) => void
  setMaqamPreset: (id: string) => void
  lowerJins: string
  upperJins: string
  homeDegree: number
  ghammazLabel: string | null
  ghammazDegree: number
  setLowerJins: (id: string) => void
  setUpperJins: (id: string) => void
  upperJinsOptions: UpperJinsOption[]
  pluckCourse: (index: number) => void
  glideCourse: (index: number) => void
  holdCourse: (index: number) => void
  releaseHold: () => void
  onVibrato: (cents: number, rateHz: number) => void
  // P4a: recording
  recordingState: RecorderState
  recordingElapsedDisplay: string
  startRecording: () => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
  // P4a: drone
  droneEnabled: boolean
  setDroneEnabled: (b: boolean) => void
  droneGain: number
  setDroneGain: (v: number) => void
  // P4a: metronome
  metronomeEnabled: boolean
  setMetronomeEnabled: (b: boolean) => void
  metronomeBpm: number
  setMetronomeBpm: (bpm: number) => void
  tapMetronome: () => void
  // P4b: microtonal MIDI out (off by default)
  midiEnabled: boolean
  setMidiEnabled: (b: boolean) => Promise<void>
  midiSupport: MidiSupportState
  midiOutputs: readonly MidiOutputInfo[]
  midiOutputId: string | null
  setMidiOutputId: (id: string | null) => void
  midiBendRange: number
  setMidiBendRange: (semitones: number) => void
}

const EMPTY_READING: QanunReading = {
  maqamName: 'Maqam Rast',
  lowerJins: 'rast',
  upperJins: 'rast',
  tonicMidi: DEFAULT_TONIC_MIDI,
  homeNote: 'C',
  lastPluckMidi: null
}

export const useQanunEngine = ({ videoRef, canvasRef }: UseQanunEngineArgs): UseQanunEngine => {
  const [status, setStatus] = useState<QanunStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reading, setReading] = useState<QanunReading>(EMPTY_READING)
  const [tonicMidi, setTonicMidi] = useState(DEFAULT_TONIC_MIDI)
  const [mandalState, setMandalStateRaw] = useState<MandalState>(DEFAULT_RAST_STATE)
  // Jins-driven modulation: the active lower jins re-anchors the home tonic; the
  // upper jins modulates on the ghammāz. Both default to Rast (home degree 1).
  const [lowerJins, setLowerJinsState] = useState('rast')
  const [upperJins, setUpperJinsState] = useState('rast')
  const [homeDegree, setHomeDegreeState] = useState(1)
  const [highlightIndices, setHighlightIndices] = useState<number[]>([])
  const [pluckedIndices, setPluckedIndices] = useState<number[]>([])
  const [courses, setCourses] = useState<Course[]>(() =>
    buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
  )

  // P4a: recording state (idle by default — recorder is lazily created).
  const [recordingState, setRecordingState] = useState<RecorderState>('idle')
  const [recordingElapsedFrames, setRecordingElapsedFrames] = useState(0)

  // P4a: drone state (off by default).
  const [droneEnabled, setDroneEnabledState] = useState(false)
  const [droneGain, setDroneGainState] = useState(0.25)

  // P4a: metronome state (off by default, 120 BPM default).
  const [metronomeEnabled, setMetronomeEnabledState] = useState(false)
  const [metronomeBpm, setMetronomeBpmState] = useState(120)
  // Ref that mirrors metronomeBpm so ensureMetronome can read the initial BPM
  // without taking it as a dep (which would cause callback-identity churn on
  // every BPM change before the metronome is even created).
  const metronomeBpmRef = useRef(120)

  // P4b: MIDI out state (off by default).
  const [midiEnabled, setMidiEnabledState] = useState(false)
  const [midiSupport, setMidiSupportState] = useState<MidiSupportState>('unknown')
  const [midiOutputs, setMidiOutputsState] = useState<readonly MidiOutputInfo[]>([])
  const [midiOutputId, setMidiOutputIdState] = useState<string | null>(null)
  const [midiBendRange, setMidiBendRangeState] = useState(2)
  const midiRef = useRef<MidiOutEngine | null>(null)

  // Hot refs (read inside the frame loop without re-subscribing).
  const tonicRef = useRef(DEFAULT_TONIC_MIDI)
  const mandalRef = useRef<MandalState>(DEFAULT_RAST_STATE)
  const lowerJinsRef = useRef('rast')
  const upperJinsRef = useRef('rast')
  const homeDegreeRef = useRef(1)
  const coursesRef = useRef<Course[]>(courses)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const audioRef = useRef<QanunEngine | null>(null)
  // Sample rate is exposed as state (not a ref) so the elapsed display can read it
  // during render. It is set once when the engine is first started and never changes.
  const [sampleRate, setSampleRate] = useState(48000)
  const recorderRef = useRef<Recorder | null>(null)
  const droneRef = useRef<DroneEngine | null>(null)
  const metronomeRef = useRef<MetronomeEngine | null>(null)
  // Timer for polling elapsed frames while recording.
  const elapsedTimerRef = useRef<number | null>(null)
  const frameHandleRef = useRef<FrameHandle | null>(null)
  const runningRef = useRef(false)
  const frameCounterRef = useRef(0)
  // Frame index at which the current pluck glow expires (cleared in tick).
  const pluckClearRef = useRef(0)
  // Tracks whether a pointer hold (rashsh) is currently active.
  const holdingRef = useRef(false)

  // One pinchPlay per role slot — handles pluck / sustain / glide / release.
  // glideDebounceSec course-locks the sustain so a vertical vibrato wobble (or
  // incidental lateral drift) doesn't switch strings.
  // Tighter close/open thresholds than the defaults so a pluck fires only on a
  // real (near-complete) pinch, not as the fingers approach.
  const pinchPlayRef = useRef([
    createPinchPlay({ glideDebounceSec: 0.07, closeThreshold: 0.03, openThreshold: 0.045 }),
    createPinchPlay({ glideDebounceSec: 0.07, closeThreshold: 0.03, openThreshold: 0.045 })
  ])
  // Higher minCutoff + beta than before → much less smoothing lag when the hand
  // moves fast (beta is the speed coefficient; low beta was the "slow tracking").
  const fingerFiltersRef = useRef([createOneEuroFilter({ minCutoff: 1.7, beta: 0.08 }), createOneEuroFilter({ minCutoff: 1.7, beta: 0.08 })])
  // Per-hand vibrato detectors — a deliberate vertical wave on either hand bends
  // the ringing note(s). Each slot's held course (null = none) is reconciled each
  // frame into a single or alternating rashsh; the key detects set changes.
  const vibratoRefs = useRef([createVibrato(), createVibrato()])
  const sustainCourseRef = useRef<(number | null)[]>([null, null])
  const lastHoldKeyRef = useRef('')
  // Guards so the per-frame highlight/pluck setState only fires when the set of
  // lit courses actually changes (otherwise React re-renders 84 string spans every frame).
  const lastHoverKeyRef = useRef('')
  const lastPluckedKeyRef = useRef('')

  const recompute = useCallback((next: MandalState, nextTonic: number): void => {
    const field = buildField({ tonicMidi: nextTonic, mandalState: next })
    coursesRef.current = field
    setCourses(field)
    const id = identifyAjnas(next)
    const home = homeDegreeRef.current
    const homeNote = degreeNoteLabel({ tonicMidi: nextTonic, degree: home, offset: offsetOf(next, home) })
    setReading((r) => ({ ...r, maqamName: id.maqamName, lowerJins: id.lower, upperJins: id.upper, tonicMidi: nextTonic, homeNote }))
    // The drone follows the maqam's home note (not the fixed key).
    droneRef.current?.setTonic(nextTonic + offsetOf(next, home))
  }, [])

  const setMandalAll = useCallback((next: MandalState): void => {
    mandalRef.current = next
    setMandalStateRaw(next)
    recompute(next, tonicRef.current)
  }, [recompute])

  const setMandalState = useCallback((state: MandalState): void => {
    setMandalAll(state)
  }, [setMandalAll])

  const setMaqamPreset = useCallback((id: string): void => {
    const preset = MAQAM_PRESETS.find((p) => p.id === id)
    if (preset) setMandalAll(preset.mandalState)
  }, [setMandalAll])

  // Pick a lower jins: load its scale, re-anchor the home tonic to that jins's
  // conventional degree, reset to its default upper, then OVERRIDE the readout
  // with the explicit maqam name. The override is what makes "Bayati · D" show
  // correctly even though identify reads the raw (Rast-collection) scale.
  const setLowerJins = useCallback((id: string): void => {
    const { mandalState: scale, homeDegree: home } = applyLowerJins(id)
    const up = lowerJinsById(id).upperOptions[0]
    lowerJinsRef.current = id
    upperJinsRef.current = up
    homeDegreeRef.current = home
    setLowerJinsState(id)
    setUpperJinsState(up)
    setHomeDegreeState(home)
    mandalRef.current = scale
    setMandalStateRaw(scale)
    recompute(scale, tonicRef.current)
    setReading((r) => ({ ...r, maqamName: maqamNameFor(id, up), lowerJins: id, upperJins: up }))
  }, [recompute])

  // Pick an upper jins: modulate on the ghammāz of the current lower jins, then
  // override the readout name (identify can't name the modulated collection).
  const setUpperJins = useCallback((id: string): void => {
    const next = applyUpperJins(mandalRef.current, id, homeDegreeRef.current, lowerJinsRef.current)
    upperJinsRef.current = id
    setUpperJinsState(id)
    mandalRef.current = next
    setMandalStateRaw(next)
    recompute(next, tonicRef.current)
    setReading((r) => ({ ...r, maqamName: maqamNameFor(lowerJinsRef.current, id), upperJins: id }))
  }, [recompute])

  const setTonic = useCallback((midi: number): void => {
    tonicRef.current = midi
    setTonicMidi(midi)
    recompute(mandalRef.current, midi)
    // (recompute re-tunes the drone — it follows the home note.)
  }, [recompute])

  // Keyboard modulation: Q W E R T Y U I O pick the lower jins (in list order);
  // 1 2 3 4 5 pick the upper jins from the current lower jins's options. Ignored
  // while typing in a form field or when a modifier is held.
  useEffect(() => {
    const LOWER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o']
    const UPPER_KEYS = ['1', '2', '3', '4', '5']
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const li = LOWER_KEYS.indexOf(e.key.toLowerCase())
      const families = lowerJinsList()
      if (li !== -1 && li < families.length) { setLowerJins(families[li].id); return }
      const ui = UPPER_KEYS.indexOf(e.key)
      if (ui !== -1) {
        const opts = lowerJinsById(lowerJinsRef.current).upperOptions
        if (ui < opts.length) setUpperJins(opts[ui])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setLowerJins, setUpperJins])

  /** Lazily creates + starts the audio engine on first user interaction. */
  const ensureAudioEngine = useCallback(async (): Promise<void> => {
    if (!audioRef.current) {
      audioRef.current = createQanunEngine({ polyphony: 16 })
      setSampleRate(audioRef.current.getSampleRate())
    }
    if (!audioRef.current.isStarted) await audioRef.current.start()
  }, [])

  // ── P4a: recorder helpers ───────────────────────────────────────────────────

  /** Lazy-create the recorder, wired to the post-fx bus. */
  const ensureRecorder = useCallback((): Recorder => {
    if (recorderRef.current) return recorderRef.current
    const engine = audioRef.current
    if (!engine) throw new Error('Audio engine not initialised before recorder')
    const audioContext = Tone.getContext().rawContext as AudioContext
    const rec = createRecorder({
      audioContext,
      sourceNode: engine.getRecorderTap(),
      onStateChange: (state) => {
        setRecordingState(state)
        if (state !== 'recording') {
          // Stop the elapsed polling timer when no longer recording.
          if (elapsedTimerRef.current !== null) {
            window.clearInterval(elapsedTimerRef.current)
            elapsedTimerRef.current = null
          }
          setRecordingElapsedFrames(0)
        }
      },
      onMaxDurationReached: () => {
        // No toast in this phase; the UI will see state→encoding automatically.
      },
      onEncoderError: () => {
        // Silently ignored — the recorder resolves with a partial WAV on error anyway.
      }
    })
    recorderRef.current = rec
    return rec
  }, [])

  const startRecording = useCallback(async (): Promise<void> => {
    // Ensure the audio engine is up before we try to tap it.
    await ensureAudioEngine()
    const rec = ensureRecorder()
    if (rec.getState() !== 'idle') return
    await rec.start()
    // Poll elapsed frames every 500 ms while recording.
    elapsedTimerRef.current = window.setInterval(() => {
      const frames = rec.getElapsedFrames()
      setRecordingElapsedFrames(frames)
    }, 500)
  }, [ensureAudioEngine, ensureRecorder])

  const stopRecording = useCallback((): void => {
    const rec = recorderRef.current
    if (!rec || rec.getState() !== 'recording') return
    void rec.stop().then(({ wav }) => {
      // Browser-only download (qanun is web-only, no Electron bridge).
      const blob = new Blob([wav], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qanun-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`
      // Append to the DOM before clicking — a detached anchor's download click
      // is silently ignored in some browsers (e.g. older Firefox).
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }).catch(() => {
      // Encoding errors are surfaced via onEncoderError; nothing to do here.
    })
  }, [])

  const cancelRecording = useCallback((): void => {
    recorderRef.current?.cancel()
  }, [])

  // ── P4a: drone helpers ──────────────────────────────────────────────────────

  /** Lazy-create the drone engine, connected to the sumBus. */
  const ensureDrone = useCallback((): DroneEngine => {
    if (droneRef.current) return droneRef.current
    const engine = audioRef.current
    if (!engine) throw new Error('Audio engine not initialised before drone')
    const d = createDrone({ output: engine.sumBus, initialTonicMidi: tonicRef.current + offsetOf(mandalRef.current, homeDegreeRef.current) })
    droneRef.current = d
    return d
  }, [])

  const setDroneEnabled = useCallback((b: boolean): void => {
    void ensureAudioEngine().then(() => {
      const d = ensureDrone()
      void d.setEnabled(b).then(() => setDroneEnabledState(d.enabled))
    })
  }, [ensureAudioEngine, ensureDrone])

  const setDroneGain = useCallback((v: number): void => {
    setDroneGainState(v)
    droneRef.current?.setGain(v)
  }, [])

  // ── P4a: metronome helpers ──────────────────────────────────────────────────

  /** Lazy-create the metronome engine, connected to the sumBus. */
  const ensureMetronome = useCallback((): MetronomeEngine => {
    if (metronomeRef.current) return metronomeRef.current
    const engine = audioRef.current
    if (!engine) throw new Error('Audio engine not initialised before metronome')
    // Read BPM from the ref so this callback doesn't need metronomeBpm in its
    // dep array — that would cause identity churn on every BPM keystroke.
    const m = createMetronome({ output: engine.sumBus, initialBpm: metronomeBpmRef.current })
    metronomeRef.current = m
    return m
  }, [])

  const setMetronomeEnabled = useCallback((b: boolean): void => {
    void ensureAudioEngine().then(() => {
      const m = ensureMetronome()
      void m.setEnabled(b).then(() => setMetronomeEnabledState(m.enabled))
    })
  }, [ensureAudioEngine, ensureMetronome])

  const setMetronomeBpm = useCallback((bpm: number): void => {
    metronomeBpmRef.current = bpm
    setMetronomeBpmState(bpm)
    metronomeRef.current?.setBpm(bpm)
  }, [])

  const tapMetronome = useCallback((): void => {
    // Ensure engine is ready; metronome tap is fire-and-forget.
    void ensureAudioEngine().then(() => {
      const m = ensureMetronome()
      m.tap()
      // Sync displayed BPM after tap (tap may have updated it).
      setMetronomeBpmState(m.bpm)
    })
  }, [ensureAudioEngine, ensureMetronome])

  // ── P4b: MIDI out helpers ────────────────────────────────────────────────────

  /** Lazily create the MIDI engine (constructed once). */
  const ensureMidi = useCallback((): MidiOutEngine => {
    if (!midiRef.current) {
      midiRef.current = createMidiOut({
        onOutputsChange: (outputs) => setMidiOutputsState(outputs)
      })
    }
    return midiRef.current
  }, [])

  const setMidiEnabled = useCallback(async (b: boolean): Promise<void> => {
    setMidiEnabledState(b)
    if (!b) return
    const midi = ensureMidi()
    await midi.start()
    setMidiSupportState(midi.support)
    setMidiOutputsState(midi.outputs)
  }, [ensureMidi])

  const setMidiOutputId = useCallback((id: string | null): void => {
    setMidiOutputIdState(id)
    midiRef.current?.setOutput(id)
  }, [])

  const setMidiBendRange = useCallback((semitones: number): void => {
    setMidiBendRangeState(semitones)
    midiRef.current?.setBendRange(semitones)
  }, [])

  /**
   * Fire-and-forget MIDI note emission. Called alongside every audio.pluck() when
   * MIDI is enabled. Deliberately cheap — just delegates to playNote() with no await.
   */
  const emitMidi = useCallback((freqHz: number, velocity: number): void => {
    if (!midiEnabled) return
    midiRef.current?.playNote({ freqHz, velocity })
  }, [midiEnabled])

  // ── Pointer play primitives ─────────────────────────────────────────────────
  // These work without the webcam — ensureAudioEngine() handles lazy audio init.

  const POINTER_VELOCITY = 0.7

  const pluckCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndices([index])
      setPluckedIndices([index])
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
      audio.pluck({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY })
      emitMidi(field[index].freqHz, POINTER_VELOCITY)
    })
  }, [ensureAudioEngine, emitMidi])

  const glideCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndices([index])
      setPluckedIndices([index])
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
      audio.pluck({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY })
      emitMidi(field[index].freqHz, POINTER_VELOCITY)
    })
  }, [ensureAudioEngine, emitMidi])

  const holdCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndices([index])
      holdingRef.current = true
      // Pass immediate:false because pluckCourse() already attacked ~150 ms
      // earlier on pointer-down; we only want to start the rashsh loop.
      audio.holdStart({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY, immediate: false })
      emitMidi(field[index].freqHz, POINTER_VELOCITY)
    })
  }, [ensureAudioEngine, emitMidi])

  const releaseHold = useCallback((): void => {
    if (!holdingRef.current) return
    holdingRef.current = false
    audioRef.current?.holdStop()
  }, [])

  // Mouse-path vibrato: StringField computes depth/rate from the pointer's
  // vertical drag and pushes it straight to the engine (null-guarded — audio may
  // not exist yet).
  const onVibrato = useCallback((cents: number, rateHz: number): void => {
    audioRef.current?.setVibrato({ cents, rateHz })
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
    const { playHands } = deriveHandRoles({ rightHandIdx, leftHandIdx })
    const field = coursesRef.current

    // Fingertips to draw this frame, collected during detection and rendered
    // AFTER the audio path so canvas work never delays a pluck.
    const playTips: { tip: NormPoint; pinched: boolean }[] = []

    // --- Playing hands ---
    let lastPluckMidi: number | null = null
    const hoverCourses: number[] = []
    const pluckedCourses: number[] = []
    // Raw (un-mirrored) index-tip y per slot — fed to the vibrato detector after
    // the loop for whichever slot is sustaining. -1 = no tip this frame.
    const slotTipY: number[] = [-1, -1]
    playHands.forEach((handIdx, slot) => {
      if (slot > 1) return // two-slot pool
      const lm = result.landmarks[handIdx]
      const tip = lm[INDEX_TIP]
      const pinchDist = pinchDistance({ a: tip, b: lm[THUMB_TIP] })
      slotTipY[slot] = tip.y
      playTips.push({ tip, pinched: pinchDist < PINCH_VISUAL_THRESHOLD })
      const screenX = fingerFiltersRef.current[slot].filter({ x: 1 - tip.x, tNow })
      const course = nearestCourse({
        x: screenX,
        courseCount: field.length,
        fieldLeft: PLAY_FIELD_LEFT,
        fieldRight: PLAY_FIELD_RIGHT
      })
      // Every playing hand's hovered string is highlighted (both hands).
      hoverCourses.push(course)
      // Pinch-as-button: pluck on close edge, sustain when held, glide on course change.
      const pinchEvts = pinchPlayRef.current[slot].update({
        pinchDist,
        courseIndex: course,
        tNow
      })
      for (const ev of pinchEvts) {
        if (ev.type === 'release') {
          // Sustain ended for this slot — the per-frame reconcile updates audio.
          sustainCourseRef.current[slot] = null
        } else if (ev.type === 'sustain') {
          const c = ev.courseIndex
          if (field[c]) {
            // Record the held course; the reconcile (after the loop) starts the
            // rashsh — alternating between the two when both hands hold at once.
            sustainCourseRef.current[slot] = c
            pluckedCourses.push(c)
          }
        } else if (ev.type === 'pluck') {
          const c = ev.courseIndex
          if (field[c]) {
            audio.pluck({ freqHz: field[c].freqHz, velocity: ev.velocity })
            emitMidi(field[c].freqHz, ev.velocity)
            lastPluckMidi = field[c].midi
            pluckedCourses.push(c)
          }
        } else if (ev.type === 'glide') {
          const c = ev.courseIndex
          if (field[c]) {
            sustainCourseRef.current[slot] = null // gliding ends the old sustain
            audio.pluck({ freqHz: field[c].freqHz, velocity: ev.velocity })
            emitMidi(field[c].freqHz, ev.velocity)
            lastPluckMidi = field[c].midi
            pluckedCourses.push(c)
          }
        }
      }
    })

    // --- Reconcile the sustained hold to the set of held courses ---
    // 0 held → stop; 1 → single rashsh; 2 → alternate (higher note first). Only
    // re-issued when the set changes, so the loop isn't restarted every frame.
    const held = sustainCourseRef.current.filter((c): c is number => c !== null && !!field[c])
    const holdKey = [...held].sort((a, b) => a - b).join(',')
    if (holdKey !== lastHoldKeyRef.current) {
      lastHoldKeyRef.current = holdKey
      if (held.length === 0) {
        audio.holdStop()
      } else if (held.length === 1) {
        audio.holdStart({ freqHz: field[held[0]].freqHz, velocity: SUSTAIN_VELOCITY, immediate: false })
      } else {
        const freqs = held.map((c) => field[c].freqHz).sort((a, b) => b - a) // higher first
        audio.holdAlternate({ freqs, velocity: SUSTAIN_VELOCITY })
      }
    }

    // --- Vibrato from a deliberate vertical wave on EITHER hand ---
    // createVibrato gates to intentional waves (slow drift = nothing), and the
    // Tone.Vibrato node only colours notes that are actually ringing, so feeding
    // every present hand is safe. Vertical motion never changes the course.
    let vibCents = 0
    let vibRate = 5.5
    for (let slot = 0; slot < 2; slot++) {
      const y = slotTipY[slot]
      const present = y >= 0
      const r = vibratoRefs.current[slot].update({ y: present ? y : 0, tNow, active: present })
      if (r.cents > vibCents) {
        vibCents = r.cents
        vibRate = r.rateHz || vibRate
      }
    }
    audio.setVibrato({ cents: vibCents, rateHz: vibRate })

    frameCounterRef.current += 1
    if (lastPluckMidi !== null || frameCounterRef.current % READING_PUSH_EVERY_N_FRAMES === 0) {
      setReading((r) => ({ ...r, lastPluckMidi: lastPluckMidi ?? r.lastPluckMidi }))
    }

    // --- String highlight / pluck feedback (state for StringField) ---
    const hoverKey = hoverCourses.slice().sort((a, b) => a - b).join(',')
    if (hoverKey !== lastHoverKeyRef.current) {
      lastHoverKeyRef.current = hoverKey
      setHighlightIndices(hoverCourses)
    }
    if (pluckedCourses.length > 0) {
      setPluckedIndices(pluckedCourses)
      lastPluckedKeyRef.current = pluckedCourses.slice().sort((a, b) => a - b).join(',')
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
    } else if (frameCounterRef.current >= pluckClearRef.current && lastPluckedKeyRef.current !== '') {
      setPluckedIndices([])
      lastPluckedKeyRef.current = ''
    }

    // --- Overlay drawing (finger rings) ---
    // Small, calm rings that sit on the fingertip. The canvas shares the video's
    // CSS scaleX(-1), so we draw in raw (un-mirrored) coords. On a pinch the ring
    // tightens and a bright dot fills the centre — immediate "press" feedback.
    // Strictly after the audio path so canvas work never delays a pluck.
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.shadowColor = OVERLAY_SHADOW
      ctx.shadowBlur = OVERLAY_SHADOW_BLUR
      const drawTip = (tip: NormPoint, pinched: boolean, ringColor: string, radius: number): void => {
        const { x, y } = projectPoint({ p: tip, width: w, height: h, mirror: false })
        ctx.strokeStyle = pinched ? PLUCK_RING_COLOR : ringColor
        ctx.lineWidth = pinched ? 2.25 : 1.6
        ctx.beginPath()
        ctx.arc(x, y, pinched ? radius - 1.5 : radius, 0, Math.PI * 2)
        ctx.stroke()
        if (pinched) {
          // Filled centre dot — the pinch "registered" cue.
          ctx.fillStyle = PLUCK_RING_COLOR
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // Playing hands: bone-white rings; tighten + fill on pinch.
      playTips.forEach(({ tip, pinched }) => drawTip(tip, pinched, PLAY_RING_COLOR, 9))
      // Reset shadow so the next frame's clearRect / draws aren't haloed twice.
      ctx.shadowColor = 'rgba(0, 0, 0, 0)'
      ctx.shadowBlur = 0
    }

    scheduleNext()
  }, [videoRef, canvasRef, setMandalAll, emitMidi])

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
      pinchPlayRef.current.forEach((d) => d.reset())
      fingerFiltersRef.current.forEach((f) => f.reset())
      vibratoRefs.current.forEach((v) => v.reset())
      sustainCourseRef.current = [null, null]
      lastHoldKeyRef.current = ''
      frameCounterRef.current = 0
      pluckClearRef.current = 0
      setHighlightIndices([])
      setPluckedIndices([])
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
    pinchPlayRef.current.forEach((d) => d.reset())
    fingerFiltersRef.current.forEach((f) => f.reset())
    vibratoRefs.current.forEach((v) => v.reset())
    sustainCourseRef.current = [null, null]
    lastHoldKeyRef.current = ''
    // Stop any ringing rashsh + clear engine vibrato so Stop→Start is clean.
    audioRef.current?.holdStop()
    audioRef.current?.setVibrato({ cents: 0 })
    // Clear any lingering overlay ring and the string highlight/pluck glow.
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHighlightIndices([])
    setPluckedIndices([])
    setStatus('idle')
  }, [videoRef, canvasRef])

  // Release renderer-side resources on unmount: the audio graph and the
  // MediaPipe landmarker's WASM. Both are lazily rebuilt on the next start().
  useEffect(
    () => () => {
      if (elapsedTimerRef.current !== null) {
        window.clearInterval(elapsedTimerRef.current)
      }
      recorderRef.current?.dispose()
      droneRef.current?.dispose()
      metronomeRef.current?.dispose()
      audioRef.current?.dispose()
      landmarkerRef.current?.close()
      midiRef.current?.dispose()
    },
    []
  )


  // Ghammāz upper-jins options — contextual to the active lower jins + home.
  const upperJinsOptions = upperOptions(lowerJins, mandalState, homeDegree)

  // The scale degree the upper jins pivots on, relative to the maqam tonic
  // (5 for Rast, 4 for Bayati, 3 for Sikah) — shown in the switcher header.
  const ghammazDegree = ghammazFieldDegree(lowerJins, homeDegree)
  const ghammazLabel = String(ghammazDegree - homeDegree + 1)

  // P4a: derive display string for recording elapsed time from stored frame count.
  const recordingElapsedDisplay = formatElapsed(recordingElapsedFrames, sampleRate)

  return {
    status,
    errorMsg,
    reading,
    courses,
    mandalState,
    tonicMidi,
    highlightIndices,
    pluckedIndices,
    start,
    stop,
    setTonic,
    setMandalState,
    setMaqamPreset,
    lowerJins,
    upperJins,
    homeDegree,
    ghammazLabel,
    ghammazDegree,
    setLowerJins,
    setUpperJins,
    upperJinsOptions,
    pluckCourse,
    glideCourse,
    holdCourse,
    releaseHold,
    onVibrato,
    // P4a: recording
    recordingState,
    recordingElapsedDisplay,
    startRecording,
    stopRecording,
    cancelRecording,
    // P4a: drone
    droneEnabled,
    setDroneEnabled,
    droneGain,
    setDroneGain,
    // P4a: metronome
    metronomeEnabled,
    setMetronomeEnabled,
    metronomeBpm,
    setMetronomeBpm,
    tapMetronome,
    // P4b: MIDI out
    midiEnabled,
    setMidiEnabled,
    midiSupport,
    midiOutputs,
    midiOutputId,
    setMidiOutputId,
    midiBendRange,
    setMidiBendRange,
  }
}
