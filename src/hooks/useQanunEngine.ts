import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { MandalState, Course } from '../lib/music/types'
import type { NormPoint, QanunReading, QanunStatus } from '../types'
import { DEFAULT_RAST_STATE, DEGREE_COUNT, offsetOf, positionsForDegree, setMandal, stepMandalPosition } from '../lib/music/ajnas/MANDALS'
import { buildField, DEFAULT_TONIC_MIDI, DETUNE_LIMIT_CENTS, FIELD_LEADING_TONES, FIELD_REACH_ABOVE_TONIC } from '../lib/music/buildField'
import { identifyAjnas } from '../lib/music/identifyAjnas'
import { degreeNoteLabel } from '../lib/music/degreeLabel'
import { applyLowerJins, lowerJinsById, lowerJinsList, maqamNameFor } from '../lib/music/sayr/lowerJins'
import { applyUpperJins, upperOptions, ghammazFieldDegree, type UpperJinsOption } from '../lib/music/sayr/upperJins'
import { courseWithHysteresis, coursesCrossed, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from '../lib/gesture/nearestCourse'
import { createPinchPlay } from '../lib/gesture/pinchPlay'
import { resolveActiveFinger, type ActiveFinger } from '../lib/gesture/activeFinger'
import { createQanunEngine, DEFAULT_TREMOLO_HZ, type QanunEngine } from '../lib/audio/createQanunEngine'
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
import { startCamera, describeCameraError } from '../lib/vision/startCamera'
import { stopCamera } from '../lib/vision/stopCamera'
import { INDEX_TIP, INDEX_DIP, THUMB_TIP, THUMB_IP, MIDDLE_TIP, MIDDLE_DIP, INDEX_MCP, PINKY_MCP } from '../lib/vision/constants'
import { extrapolateTip } from '../lib/vision/extrapolateTip'
import { projectPoint } from '../lib/draw/projectPoint'

// The playable string window — trims the raw octave grid to 2 leading tones below
// the tonic + 3 full octaves + 1 tone above it (25 strings; top is one tone past
// the third-octave tonic). buildField grows its raw grid to fit the requested
// reach. Shared by every buildField call so the field shape can't drift between
// init and recompute.
const FIELD_WINDOW = { leadingTones: FIELD_LEADING_TONES, reachAboveTonic: FIELD_REACH_ABOVE_TONIC } as const
// Frames a freshly plucked string stays lit before the highlight clears.
const PLUCK_GLOW_FRAMES = 6
// Frames the "a hand is being tracked" flag stays true after the last frame a
// hand was actually seen. The flag hides the OS mouse cursor (the thumb ring is
// the cursor during hand play); the grace bridges single-frame MediaPipe
// dropouts so the mouse cursor doesn't blink back on mid-play (~0.2 s at 60 fps).
const TRACK_GRACE_FRAMES = 12
// Velocity for a sustained (rashsh) note when the per-frame reconcile (re)starts
// it. Lower than a pluck: a rashsh re-strikes continuously, so a softer per-strike
// level leaves headroom and keeps sustained play (esp. with vibrato) from
// saturating the master soft-clip.
const SUSTAIN_VELOCITY = 0.5

// Overlay palette — warm bone-white rings with a soft dark halo so they read
// over the bright wood soundboard. The THUMB is the cursor and wears the
// prominent ring in the active mode's colour; the index/middle tips wear small
// pinch-state dots.
const PLAY_RING_COLOR = 'rgba(255, 244, 214, 0.92)'
const PLUCK_RING_COLOR = 'rgba(255, 255, 255, 1)'
// Trill/sustain (rashsh) engaged — a cool cyan that reads clearly distinct from
// the warm pluck/hover rings, with a gentle pulse (see drawCircle).
const TRILL_RING_COLOR = 'rgba(125, 226, 232, 0.96)'
const OVERLAY_SHADOW = 'rgba(0, 0, 0, 0.55)'

// Pinch detection is DISTANCE-INVARIANT: the thumb↔fingertip gap is measured
// relative to the palm width (a stable hand-size ref), so a pinch reads the same
// near or far from the camera. These are ratios of that gap to the palm width — a
// pinch engages below CLOSE, releases above OPEN (hysteresis). Kept generous: in
// a playing posture the palm foreshortens (inflating the ratio), so tight values
// made pinches — especially the off hand — hard to register. Tunable by feel.
const PINCH_CLOSE_RATIO = 0.6
const PINCH_OPEN_RATIO = 0.78

// Fallback velocity for sweep strikes, pluck-comparable (the pointer pluck uses
// 0.7). In practice every sweep inherits the velocity of the pinch close that
// initiated it (see strumVelocityRef) — this only covers the theoretical first
// strike before any close-edge pluck has seeded the slot.
const STRUM_FALLBACK_VELOCITY = 0.7
// Sweep strikes detected in ONE frame land simultaneously (a real sweep spreads
// its plucks in time), so a flick crossing many string centres in a single
// frame stacks energy the limiter then has to crush — audible pumping, not
// clipping (the master soft-clip already makes clipping impossible). Up to this
// many crossings per frame play at full pluck weight; past it each strike's
// velocity is scaled by sqrt(free/N) so the frame's summed energy stays near a
// fast manual burst. Timbre is untouched — every strike keeps the full
// triple-course bloom.
const STRUM_BURST_FREE_CROSSINGS = 3
// After a pluck fires, suppress the strum briefly while the pinch settles. The
// cursor is the THUMB (which barely moves during a close), so this is only a
// safety net against residual thumb wobble at the pinch — not the old gate
// against the index curl sweeping the selection axis. The baseline still
// advances during the window, so any wobble is absorbed, not played.
const STRUM_SETTLE_SEC = 0.05
const OVERLAY_SHADOW_BLUR = 6

export interface UseQanunEngineArgs {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

// Which modulation control surface is live: 'jins' (pick a lower + upper jins)
// or 'qanun' (flip individual mandals on the major scale). See docs spec.
export type ModMode = 'jins' | 'qanun'

export interface UseQanunEngine {
  status: QanunStatus
  errorMsg: string | null
  reading: QanunReading
  courses: Course[]
  mandalState: MandalState
  tonicMidi: number
  detuneCents: number
  highlightIndices: number[]
  pluckedIndices: number[]
  // True while a hand is tracked (with a short grace window) — the drawn thumb
  // ring is the cursor, so the UI hides the OS pointer while this is on.
  handTracking: boolean
  start: () => Promise<void>
  stop: () => void
  setTonic: (midi: number) => void
  setDetuneCents: (cents: number) => void
  lowerJins: string
  upperJins: string
  homeDegree: number
  ghammazLabel: string | null
  ghammazDegree: number
  setLowerJins: (id: string) => void
  setUpperJins: (id: string) => void
  upperJinsOptions: UpperJinsOption[]
  // Modulation mode: 'jins' (lower+upper picker) or 'qanun' (per-mandal flips).
  modMode: ModMode
  setModMode: (mode: ModMode) => void
  stepMandal: (degree: number, dir: 1 | -1) => void
  setMandalAt: (degree: number, offset: number) => void
  resetMandals: () => void
  pluckCourse: (index: number) => void
  glideCourse: (index: number) => void
  holdCourse: (index: number) => void
  releaseHold: () => void
  // Tremolo pulse (Hz), shared by single- and two-note holds
  tremoloHz: number
  setTremoloHz: (hz: number) => void
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
  homeNote: 'C',
  lastPluckMidi: null
}

export const useQanunEngine = ({ videoRef, canvasRef }: UseQanunEngineArgs): UseQanunEngine => {
  const [status, setStatus] = useState<QanunStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reading, setReading] = useState<QanunReading>(EMPTY_READING)
  const [tonicMidi, setTonicMidi] = useState(DEFAULT_TONIC_MIDI)
  // Global fine-tune (cents), −DETUNE_LIMIT_CENTS…+DETUNE_LIMIT_CENTS. Shifts the
  // sounding pitch of the whole instrument — strings, drone, and MIDI-out all
  // follow — without changing any note name or degree label.
  const [detuneCents, setDetuneCentsState] = useState(0)
  const [mandalState, setMandalStateRaw] = useState<MandalState>(DEFAULT_RAST_STATE)
  // Jins-driven modulation: the active lower jins re-anchors the home tonic; the
  // upper jins modulates on the ghammāz. Both default to Rast (home degree 1).
  const [lowerJins, setLowerJinsState] = useState('rast')
  const [upperJins, setUpperJinsState] = useState('rast')
  const [homeDegree, setHomeDegreeState] = useState(1)
  const [modMode, setModModeState] = useState<ModMode>('jins')
  const [highlightIndices, setHighlightIndices] = useState<number[]>([])
  const [pluckedIndices, setPluckedIndices] = useState<number[]>([])
  // True while a hand is actively tracked (its thumb-ring cursor is on screen).
  // Drives hiding the OS mouse cursor over the play field — see TRACK_GRACE_FRAMES.
  const [handTracking, setHandTracking] = useState(false)
  const [courses, setCourses] = useState<Course[]>(() =>
    buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE, ...FIELD_WINDOW })
  )

  // P4a: recording state (idle by default — recorder is lazily created).
  const [recordingState, setRecordingState] = useState<RecorderState>('idle')
  const [recordingElapsedFrames, setRecordingElapsedFrames] = useState(0)

  // Tremolo pulse (Hz) — one rate shared by the single-note rashsh and the
  // two-note trill. Ref mirrors state so the lazily-created engine can pick up
  // a value chosen before first interaction.
  const [tremoloHz, setTremoloHzState] = useState(DEFAULT_TREMOLO_HZ)
  const tremoloHzRef = useRef(DEFAULT_TREMOLO_HZ)

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
  // Mirrors midiEnabled for the frame loop: tick re-arms itself with the closure
  // it was started with, so reading the STATE there would pin the value from
  // start time — a mid-session MIDI toggle would silently not take effect.
  const midiEnabledRef = useRef(false)

  // Hot refs (read inside the frame loop without re-subscribing).
  const tonicRef = useRef(DEFAULT_TONIC_MIDI)
  const detuneCentsRef = useRef(0)
  const mandalRef = useRef<MandalState>(DEFAULT_RAST_STATE)
  const lowerJinsRef = useRef('rast')
  const upperJinsRef = useRef('rast')
  const homeDegreeRef = useRef(1)
  const modeRef = useRef<ModMode>('jins')
  // Qanun mode keeps its own tuning so toggling Jins ↔ Qanun never loses either
  // side's work; it seeds from the major scale (ʿAjam).
  const qanunStateRef = useRef<MandalState>(DEFAULT_RAST_STATE)
  // Computer-keyboard play layer: which octave the home-row keys play in (0 = from
  // the tonic). pluckCourseRef is the latest pluckCourse, read inside the keydown
  // handler without making it a dependency (pluckCourse is defined further down).
  const playOctaveRef = useRef(0)
  const pluckCourseRef = useRef<(index: number) => void>(() => {})
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
  // Course held by an active pointer (mouse/touch) rashsh, null when none. The
  // tick loop merges it into the per-frame hover set so the camera loop doesn't
  // stomp the held string's highlight the moment no hand hovers it.
  const holdingRef = useRef<number | null>(null)

  // INDEX pinch = melodic PLUCK only (tremolo is the middle finger's job; the
  // strum below handles movement while closed). Thresholds are PALM-WIDTH
  // RATIOS, not raw image distances (the tick feeds a normalized gap), so a
  // pluck fires on real finger contact at any distance.
  const indexPlayRef = useRef([
    createPinchPlay({ closeThreshold: PINCH_CLOSE_RATIO, openThreshold: PINCH_OPEN_RATIO }),
    createPinchPlay({ closeThreshold: PINCH_CLOSE_RATIO, openThreshold: PINCH_OPEN_RATIO })
  ])
  // Which finger (if any) is pinching the thumb, per slot. Drives the index↔middle
  // mode choice with hysteresis so a gesture can't flicker between pluck and
  // tremolo mid-play (see resolveActiveFinger).
  const activeFingerRef = useRef<ActiveFinger[]>(['none', 'none'])
  // Per-slot filtered finger-x from the previous frame, for strum detection: any
  // string centre the finger sweeps past re-plucks (null = not strumming).
  const strumPrevXRef = useRef<(number | null)[]>([null, null])
  // Per-slot timestamp (seconds) before which the strum is suppressed — set when a
  // pluck fires, so the pinch-curl that follows doesn't strum (see STRUM_SETTLE_SEC).
  const strumEnableAtRef = useRef<number[]>([0, 0])
  // Per-slot velocity for sweep strikes — inherited from the pinch close that
  // initiated the sweep, so a strummed string sounds exactly like the pluck
  // that started the gesture (hard pinch → hard sweep, gentle → gentle).
  const strumVelocityRef = useRef<number[]>([STRUM_FALLBACK_VELOCITY, STRUM_FALLBACK_VELOCITY])
  // Higher minCutoff + beta than before → much less smoothing lag when the hand
  // moves fast (beta is the speed coefficient; low beta was the "slow tracking").
  const fingerFiltersRef = useRef([createOneEuroFilter({ minCutoff: 1.7, beta: 0.08 }), createOneEuroFilter({ minCutoff: 1.7, beta: 0.08 })])
  const sustainCourseRef = useRef<(number | null)[]>([null, null])
  // Per-slot course selected last frame — the seed for snap hysteresis, so a finger
  // hovering near a string boundary doesn't flicker between two strings (null = no
  // hand / fresh selection).
  const lastCourseRef = useRef<(number | null)[]>([null, null])
  const lastHoldKeyRef = useRef('')
  // Guards so the per-frame highlight/pluck setState only fires when the set of
  // lit courses actually changes (otherwise React re-renders 84 string spans every frame).
  const lastHoverKeyRef = useRef('')
  const lastPluckedKeyRef = useRef('')
  // Hand-tracking cursor guard: handGraceRef counts down from TRACK_GRACE_FRAMES
  // after the last frame a hand was seen; lastHandTrackingRef debounces the
  // setState so it only fires on a true on/off transition.
  const handGraceRef = useRef(0)
  const lastHandTrackingRef = useRef(false)

  const recompute = useCallback((next: MandalState, nextTonic: number): void => {
    const detune = detuneCentsRef.current
    const field = buildField({ tonicMidi: nextTonic, mandalState: next, detuneCents: detune, ...FIELD_WINDOW })
    coursesRef.current = field
    setCourses(field)
    const id = identifyAjnas(next)
    const home = homeDegreeRef.current
    const homeNote = degreeNoteLabel({ tonicMidi: nextTonic, degree: home, offset: offsetOf(next, home), flats: true })
    // The maqam reading is only shown in Jins mode; Qanun mode hides that cell
    // (the same mandals are an ambiguous maqam without a fixed root). Keeping the
    // identify here is harmless — the value just isn't displayed in Qanun mode.
    setReading((r) => ({ ...r, maqamName: id.maqamName, homeNote }))
    // The drone follows the maqam's home note (not the fixed key), carrying the
    // same fine-tune offset (cents → fractional MIDI) so it never clashes with
    // the detuned strings.
    droneRef.current?.setTonic(nextTonic + offsetOf(next, home) + detune / 100)
  }, [])

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
    setReading((r) => ({ ...r, maqamName: maqamNameFor(id, up) }))
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
    setReading((r) => ({ ...r, maqamName: maqamNameFor(lowerJinsRef.current, id) }))
  }, [recompute])

  const setTonic = useCallback((midi: number): void => {
    tonicRef.current = midi
    setTonicMidi(midi)
    recompute(mandalRef.current, midi)
    // (recompute re-tunes the drone — it follows the home note.)
  }, [recompute])

  // Global fine-tune: clamp to ±DETUNE_LIMIT_CENTS, store, and recompute so the
  // field's freqHz (and the drone) pick up the new offset. Audio and MIDI-out
  // read field freqHz, so both follow with no extra wiring.
  const setDetuneCents = useCallback((cents: number): void => {
    const clamped = Math.max(-DETUNE_LIMIT_CENTS, Math.min(DETUNE_LIMIT_CENTS, Math.round(cents)))
    detuneCentsRef.current = clamped
    setDetuneCentsState(clamped)
    recompute(mandalRef.current, tonicRef.current)
  }, [recompute])

  // ── Qanun (mandal) mode ─────────────────────────────────────────────────────
  // Per-degree modulation over the major scale. Each action retunes one (or all)
  // mandal(s) and funnels through recompute, so the HUD, drone, and MIDI-out all
  // follow with no extra wiring. Qanun mode keeps its tuning in qanunStateRef so
  // switching modes never clobbers it.

  const setModMode = useCallback((mode: ModMode): void => {
    if (mode === modeRef.current) return
    modeRef.current = mode
    setModModeState(mode)
    if (mode === 'qanun') {
      // Qanun mode has no movable home — like a real qanun, you root the melody
      // wherever you play. We still pin degree 1 (the key) internally so the drone
      // and the readout have a tonic reference, but nothing in the UI calls it
      // "home". Default tuning is Rast.
      homeDegreeRef.current = 1
      setHomeDegreeState(1)
      mandalRef.current = qanunStateRef.current
      setMandalStateRaw(qanunStateRef.current)
      recompute(qanunStateRef.current, tonicRef.current)
    } else {
      // Back to Jins mode: rebuild the exact tuning from the saved selection so
      // the user's lower+upper choice (and home anchor) come back untouched.
      const { mandalState: base, homeDegree: home } = applyLowerJins(lowerJinsRef.current)
      const restored = applyUpperJins(base, upperJinsRef.current, home, lowerJinsRef.current)
      homeDegreeRef.current = home
      setHomeDegreeState(home)
      mandalRef.current = restored
      setMandalStateRaw(restored)
      recompute(restored, tonicRef.current)
      setReading((r) => ({ ...r, maqamName: maqamNameFor(lowerJinsRef.current, upperJinsRef.current) }))
    }
  }, [recompute])

  // Move one mandal one quarter-tone in a direction (dir +1 raises/sharper, −1
  // lowers/flatter), clamped at the ends — the directional-key + rail-arrow handler.
  const stepMandal = useCallback((degree: number, dir: 1 | -1): void => {
    if (modeRef.current !== 'qanun') return
    const positions = positionsForDegree(degree)
    if (positions.length <= 1) return // safety: nothing to step (no single-position degrees today)
    const nextOffset = stepMandalPosition(positions, offsetOf(qanunStateRef.current, degree), dir)
    const updated = setMandal(qanunStateRef.current, degree, nextOffset)
    qanunStateRef.current = updated
    mandalRef.current = updated
    setMandalStateRaw(updated)
    recompute(updated, tonicRef.current)
  }, [recompute])

  // Set one mandal directly to a chosen position — the rail click handler.
  const setMandalAt = useCallback((degree: number, offset: number): void => {
    if (modeRef.current !== 'qanun') return
    const updated = setMandal(qanunStateRef.current, degree, offset)
    qanunStateRef.current = updated
    mandalRef.current = updated
    setMandalStateRaw(updated)
    recompute(updated, tonicRef.current)
  }, [recompute])

  // Reset Qanun mode to the Rast default.
  const resetMandals = useCallback((): void => {
    if (modeRef.current !== 'qanun') return
    qanunStateRef.current = DEFAULT_RAST_STATE
    mandalRef.current = DEFAULT_RAST_STATE
    setMandalStateRaw(DEFAULT_RAST_STATE)
    recompute(DEFAULT_RAST_STATE, tonicRef.current)
  }, [recompute])

  // Keyboard modulation. Tab toggles Jins ↔ Qanun mode. In Jins mode: Q W E R T Y
  // U I O pick the lower jins, 1 2 3 4 5 the upper jins. In Qanun mode two stacked
  // key rows move the levers directionally: 1 2 3 4 5 6 7 raise C..B a quarter-tone,
  // Q W E R T Y U lower them (hold to glide — key repeat — clamped at the ends); 0 /
  // Backspace resets to Rast. Ignored while typing in a field or (except Tab) when
  // a modifier is held.
  useEffect(() => {
    const LOWER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o']
    const UPPER_KEYS = ['1', '2', '3', '4', '5']
    // Qanun mode: two adjacent rows, one quarter-tone step per press, degree d =
    // d-1. Raise on the Q row, lower on the number row directly above it.
    const QANUN_RAISE = ['q', 'w', 'e', 'r', 't', 'y', 'u'] // C..B up
    const QANUN_LOWER = ['1', '2', '3', '4', '5', '6', '7'] // C..B down
    // Computer-keyboard play layer (both modes): the home row plays the scale up
    // from the tonic; Z / X drop / raise the octave. The tonic course sits at index
    // FIELD_LEADING_TONES (the two leading tones below it come first in the field).
    const PLAY_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"]
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      // Tab flips modes — claimed before the modifier/field guards so it works
      // from anywhere on the instrument (but not while typing in the drawer).
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !inField) {
        e.preventDefault()
        setModMode(modeRef.current === 'qanun' ? 'jins' : 'qanun')
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || inField) return
      const key = e.key.toLowerCase()
      // Octave shift (Z down / X up). Skip auto-repeat so a held key steps once.
      if (key === 'z' || key === 'x') {
        if (!e.repeat) {
          const maxOct = Math.max(0, Math.floor((coursesRef.current.length - 1 - FIELD_LEADING_TONES) / DEGREE_COUNT))
          const next = playOctaveRef.current + (key === 'x' ? 1 : -1)
          playOctaveRef.current = Math.max(0, Math.min(maxOct, next))
        }
        e.preventDefault()
        return
      }
      // Home row plays the scale from the tonic — one pluck per press (no repeat).
      const pi = PLAY_KEYS.indexOf(key)
      if (pi !== -1) {
        if (!e.repeat) {
          const idx = FIELD_LEADING_TONES + playOctaveRef.current * DEGREE_COUNT + pi
          if (idx >= 0 && idx < coursesRef.current.length) pluckCourseRef.current(idx)
        }
        e.preventDefault()
        return
      }
      if (modeRef.current === 'qanun') {
        const ri = QANUN_RAISE.indexOf(key)
        if (ri !== -1) { stepMandal(ri + 1, 1); e.preventDefault(); return }
        const di = QANUN_LOWER.indexOf(key)
        if (di !== -1) { stepMandal(di + 1, -1); e.preventDefault(); return }
        if (e.key === '0' || e.key === 'Backspace') resetMandals()
        return
      }
      const li = LOWER_KEYS.indexOf(key)
      const families = lowerJinsList()
      if (li !== -1 && li < families.length) { setLowerJins(families[li].id); return }
      const ui = UPPER_KEYS.indexOf(key)
      if (ui !== -1) {
        const opts = lowerJinsById(lowerJinsRef.current).upperOptions
        if (ui < opts.length) setUpperJins(opts[ui])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setLowerJins, setUpperJins, setModMode, stepMandal, resetMandals])

  /** Lazily creates + starts the audio engine on first user interaction. */
  const ensureAudioEngine = useCallback(async (): Promise<void> => {
    if (!audioRef.current) {
      audioRef.current = createQanunEngine()
      setSampleRate(audioRef.current.getSampleRate())
      // The slider may have moved before first interaction — read the ref, not
      // state, so this callback's identity never churns with the value.
      audioRef.current.setTremoloHz(tremoloHzRef.current)
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
        // Silently ignored — on a worker crash the recorder falls back to a
        // main-thread encode of the full take, so stop() still resolves.
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
    const d = createDrone({ output: engine.sumBus, initialTonicMidi: tonicRef.current + offsetOf(mandalRef.current, homeDegreeRef.current) + detuneCentsRef.current / 100 })
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

  /** Retune the tremolo pulse — a running hold retunes in place, no restart. */
  const setTremoloHz = useCallback((hz: number): void => {
    setTremoloHzState(hz)
    tremoloHzRef.current = hz
    audioRef.current?.setTremoloHz(hz)
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
    midiEnabledRef.current = b
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
   * MIDI is enabled. Deliberately cheap — just delegates to playNote() with no
   * await. Reads the enabled flag from a ref (stable identity) so the running
   * frame loop sees toggles immediately.
   */
  const emitMidi = useCallback((freqHz: number, velocity: number): void => {
    if (!midiEnabledRef.current) return
    midiRef.current?.playNote({ freqHz, velocity })
  }, [])

  // ── Pointer play primitives ─────────────────────────────────────────────────
  // These work without the webcam — ensureAudioEngine() handles lazy audio init.

  const POINTER_VELOCITY = 0.7

  // Pointer pluck and glide are the SAME strike — full triple-course bloom at
  // POINTER_VELOCITY — so dragging across strings sounds exactly like plucking
  // each one (a single-voice glide read thin and lifeless next to a pluck). A
  // drag fires at most one strike per pointermove crossing, and the master
  // limiter + soft-clip brick-wall the sum, so there's no burst to guard
  // against here. One helper, two thin wrappers, so the highlight/glow/MIDI
  // bookkeeping lives in one place.
  const soundCourse = useCallback((index: number): void => {
    const field = coursesRef.current
    if (!field[index]) return
    // Visual feedback + the "last" readout update synchronously, NOT inside the
    // audio-start promise: the camera tick loop sets these for hand plucks, but
    // with the camera off no tick runs, so the pointer/mouse path must — and it
    // shouldn't wait on the (async, first-gesture) audio-engine start.
    setHighlightIndices([index])
    setPluckedIndices([index])
    // Keep the tick-loop dedupe guards in sync so the camera loop (when it runs)
    // sees this highlight as current state and clears it normally.
    lastHoverKeyRef.current = String(index)
    lastPluckedKeyRef.current = String(index)
    pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
    const playedMidi = field[index].midi
    setReading((r) => (r.lastPluckMidi === playedMidi ? r : { ...r, lastPluckMidi: playedMidi }))
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      if (!audio || !field[index]) return
      audio.pluck({ freqHz: field[index].freqHz, velocity: POINTER_VELOCITY, bloom: true })
      emitMidi(field[index].freqHz, POINTER_VELOCITY)
    })
  }, [ensureAudioEngine, emitMidi])

  const pluckCourse = useCallback((index: number): void => soundCourse(index), [soundCourse])
  // Keep the keydown play layer pointed at the latest pluckCourse (synced in an
  // effect, not during render, so the handler can read it without depending on it).
  useEffect(() => { pluckCourseRef.current = pluckCourse }, [pluckCourse])
  const glideCourse = useCallback((index: number): void => soundCourse(index), [soundCourse])

  const holdCourse = useCallback((index: number): void => {
    void ensureAudioEngine().then(() => {
      const audio = audioRef.current
      const field = coursesRef.current
      if (!audio || !field[index]) return
      setHighlightIndices([index])
      lastHoverKeyRef.current = String(index)
      holdingRef.current = index
      // Pass immediate:false because pluckCourse() already attacked ~150 ms
      // earlier on pointer-down; we only want to start the rashsh loop. Use the
      // softer sustain level (the pluck already gave the louder attack).
      audio.holdStart({ freqHz: field[index].freqHz, velocity: SUSTAIN_VELOCITY, immediate: false })
      emitMidi(field[index].freqHz, SUSTAIN_VELOCITY)
      const heldMidi = field[index].midi
      setReading((r) => (r.lastPluckMidi === heldMidi ? r : { ...r, lastPluckMidi: heldMidi }))
    })
  }, [ensureAudioEngine, emitMidi])

  const releaseHold = useCallback((): void => {
    // Pointer-up: clear the lit string here, because with the camera off no
    // tick ever runs to expire the highlight or the pluck glow.
    setHighlightIndices([])
    setPluckedIndices([])
    lastHoverKeyRef.current = ''
    lastPluckedKeyRef.current = ''
    if (holdingRef.current === null) return
    holdingRef.current = null
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
    // Fixed slots keyed by HANDEDNESS (0 = right, 1 = left), not array position:
    // when one hand enters or leaves the frame, the other keeps its own filter
    // history, pinch state, strum baseline, and hysteresis course instead of
    // silently inheriting the departed hand's (e.g. a tremolo it never gestured).
    const slotHands = [rightHandIdx, leftHandIdx]
    const field = coursesRef.current

    // MediaPipe y is normalized to the FULL camera frame, but the video (and the
    // ring canvas) render with object-fit: cover — which crops the frame
    // vertically whenever the board is wider than 16:9 — while strings are
    // positioned in board ELEMENT space. Remap frame-y → visible-y so the string
    // under the fingertip ring is the one that sounds (identity at zero crop).
    // Overlay drawing below stays in raw frame coords: the canvas shares the
    // video's cover crop, so the rings line up by construction.
    const coverScale = Math.max(canvas.clientWidth / canvas.width, canvas.clientHeight / canvas.height)
    const visibleYFrac = coverScale > 0 ? Math.min(1, canvas.clientHeight / (canvas.height * coverScale)) : 1
    const cropYFrac = (1 - visibleYFrac) / 2

    // Fingertips to draw this frame, collected during detection and rendered
    // AFTER the audio path so canvas work never delays a pluck. `mode` mirrors
    // the live active-finger state so the lit ring matches the audio.
    const playTips: { indexPoint: NormPoint; middlePoint: NormPoint; thumbPoint: NormPoint; mode: ActiveFinger }[] = []

    // --- Playing hands ---
    let lastPluckMidi: number | null = null
    const hoverCourses: number[] = []
    const pluckedCourses: number[] = []
    for (let slot = 0; slot < 2; slot++) {
      const handIdx = slotHands[slot]
      if (handIdx === -1) {
        // No hand in this slot — clear its gesture state so a vanished hand
        // doesn't leave a stuck tremolo or stale strum baseline behind.
        sustainCourseRef.current[slot] = null
        activeFingerRef.current[slot] = 'none'
        strumPrevXRef.current[slot] = null
        strumEnableAtRef.current[slot] = 0
        strumVelocityRef.current[slot] = STRUM_FALLBACK_VELOCITY
        lastCourseRef.current[slot] = null
        indexPlayRef.current[slot].reset()
        continue
      }
      const lm = result.landmarks[handIdx]
      const indexTip = lm[INDEX_TIP]
      const middleTip = lm[MIDDLE_TIP]
      const thumbTip = lm[THUMB_TIP]
      // The CURSOR is the thumb — the stable jaw of the pinch (the index/middle
      // curl during a close; tracking them swept the selection axis on every
      // pluck). Extrapolated past the pad-centre landmark to the visual nail tip;
      // this same point feeds the overlay, so the dot and the cursor agree.
      const thumbPoint = extrapolateTip({ tip: thumbTip, ip: lm[THUMB_IP] })
      // Index/middle state dots are likewise extrapolated to the visual
      // fingertips — DRAWING ONLY; the pinch ratios below keep the raw
      // landmarks the thresholds were tuned against.
      const indexPoint = extrapolateTip({ tip: indexTip, ip: lm[INDEX_DIP] })
      const middlePoint = extrapolateTip({ tip: middleTip, ip: lm[MIDDLE_DIP] })
      // Distance-invariant pinch ratios: each thumb↔fingertip gap ÷ palm width
      // (index-knuckle ↔ pinky-knuckle), which scales the same way with camera
      // distance — so a pinch reads the same near or far.
      const handSize = Math.max(pinchDistance({ a: lm[INDEX_MCP], b: lm[PINKY_MCP] }), 1e-3)
      const indexRatio = pinchDistance({ a: indexTip, b: thumbTip }) / handSize
      const middleRatio = pinchDistance({ a: middleTip, b: thumbTip }) / handSize
      // Pick the mode (sticky, hysteretic): index = pluck/glide, middle = tremolo.
      const active = resolveActiveFinger({
        indexRatio,
        middleRatio,
        prev: activeFingerRef.current[slot],
        closeRatio: PINCH_CLOSE_RATIO,
        openRatio: PINCH_OPEN_RATIO
      })
      activeFingerRef.current[slot] = active

      // Field position follows the THUMB's VERTICAL screen position for every
      // mode (pluck, strum, tremolo, hover): hand low → lowest pitch (field 0),
      // hand high → highest. Inverted because MediaPipe y grows downward; not
      // mirrored (only x is, for the selfie view). Cover-crop remap first (see
      // above), then the One-Euro filter smooths the 1-D scalar.
      const yVis = Math.min(1, Math.max(0, (thumbPoint.y - cropYFrac) / visibleYFrac))
      const fieldPos = fingerFiltersRef.current[slot].filter({ x: 1 - yVis, tNow })
      // The drawn ring rides the FILTERED selection position (x stays raw): the
      // cursor you see is exactly the y the course snap reads, so the ring and
      // the string highlight can never disagree (the raw landmark showed filter
      // lag as apparent imprecision near boundaries).
      const thumbRing = { x: thumbPoint.x, y: cropYFrac + (1 - fieldPos) * visibleYFrac }
      // Snap with hysteresis: hold the previous string until the finger crosses far
      // enough into a neighbour, so a hand hovering near a boundary doesn't flicker.
      const course = courseWithHysteresis({
        x: fieldPos,
        prevCourse: lastCourseRef.current[slot],
        courseCount: field.length,
        fieldLeft: PLAY_FIELD_LEFT,
        fieldRight: PLAY_FIELD_RIGHT
      })
      lastCourseRef.current[slot] = course
      // Every playing hand's hovered string is highlighted (both hands).
      hoverCourses.push(course)

      // INDEX detector is always advanced (so close-speed → velocity stays
      // correct), but only sounds while index mode is active.
      const pp = indexPlayRef.current[slot]
      const pinchEvts = pp.update({ pinchDist: indexRatio, courseIndex: course, tNow })
      if (active === 'index') {
        for (const ev of pinchEvts) {
          if (field[ev.courseIndex]) {
            // Deliberate pluck on the close edge — blooms (3 voices), velocity
            // from pinch speed.
            audio.pluck({ freqHz: field[ev.courseIndex].freqHz, velocity: ev.velocity, bloom: true })
            emitMidi(field[ev.courseIndex].freqHz, ev.velocity)
            lastPluckMidi = field[ev.courseIndex].midi
            pluckedCourses.push(ev.courseIndex)
            strumVelocityRef.current[slot] = ev.velocity // the sweep inherits this pluck's weight
            strumPrevXRef.current[slot] = fieldPos // baseline so the close note isn't re-strummed
            strumEnableAtRef.current[slot] = tNow + STRUM_SETTLE_SEC // let the pinch curl settle first
          }
        }
        // Strum: re-pluck every string centre the finger sweeps past since the
        // last frame — INCLUDING the same string on the way back. Each strike is
        // the SAME event as a deliberate pluck: full triple-course bloom at the
        // initiating pinch's velocity, so a sweep sounds as present as plucking
        // each string by hand (the old single-voice/fixed-0.6 strikes read thin
        // and lifeless next to a pluck). The master limiter + soft-clip make the
        // sum clip-proof; the only guard left is the single-frame burst scale
        // (see STRUM_BURST_FREE_CROSSINGS). Suppressed until the post-pluck
        // settle window passes (the curl is absorbed below).
        const prevX = strumPrevXRef.current[slot]
        if (prevX !== null && tNow >= strumEnableAtRef.current[slot]) {
          const crossed = coursesCrossed({ prevX, curX: fieldPos, courseCount: field.length, fieldLeft: PLAY_FIELD_LEFT, fieldRight: PLAY_FIELD_RIGHT })
          // Equal-energy taming for one-frame bursts only: N simultaneous
          // strikes sum ~N× the power of one, so past the free allowance each
          // velocity scales by sqrt(free/N). Per-strike timbre is never thinned.
          const burstScale = crossed.length > STRUM_BURST_FREE_CROSSINGS
            ? Math.sqrt(STRUM_BURST_FREE_CROSSINGS / crossed.length)
            : 1
          const strumVelocity = strumVelocityRef.current[slot] * burstScale
          for (const c of crossed) {
            if (field[c]) {
              audio.pluck({ freqHz: field[c].freqHz, velocity: strumVelocity, bloom: true })
              emitMidi(field[c].freqHz, strumVelocity)
              lastPluckMidi = field[c].midi
              pluckedCourses.push(c)
            }
          }
        }
        strumPrevXRef.current[slot] = fieldPos
      } else {
        strumPrevXRef.current[slot] = null // not in pluck mode → no strum baseline
      }

      // MIDDLE = tremolo: while it's the active pinch, hold the hand's current
      // course (the reconcile below turns it into a rashsh; two held → the
      // alternating two-note trill). Moving the hand slides the tremolo across strings.
      if (active === 'middle' && field[course]) {
        sustainCourseRef.current[slot] = course
        pluckedCourses.push(course)
        lastPluckMidi = field[course].midi
      } else {
        sustainCourseRef.current[slot] = null
      }

      // Overlay: the thumb cursor ring + small index/middle state dots; the
      // active mode colours the thumb (white = pluck, cyan = tremolo).
      playTips.push({ indexPoint, middlePoint, thumbPoint: thumbRing, mode: active })
    }

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

    frameCounterRef.current += 1

    // --- Hand-tracking cursor flag ---
    // A drawn thumb ring (one per detected hand) IS the cursor during hand play,
    // so the OS mouse cursor is hidden whenever a hand is tracked. Refresh the
    // grace on any detected hand and decay it otherwise; flip the React flag only
    // on a true transition so this doesn't re-render every frame.
    if (playTips.length > 0) handGraceRef.current = TRACK_GRACE_FRAMES
    else if (handGraceRef.current > 0) handGraceRef.current -= 1
    const tracking = handGraceRef.current > 0
    if (tracking !== lastHandTrackingRef.current) {
      lastHandTrackingRef.current = tracking
      setHandTracking(tracking)
    }

    // Push the HUD's "last" cell only on an actual change — the updater returns
    // the SAME object when nothing changed, so React skips the re-render (the
    // whole Qanun tree would otherwise re-render at frame rate during tremolo).
    if (lastPluckMidi !== null) {
      const lp = lastPluckMidi
      setReading((r) => (r.lastPluckMidi === lp ? r : { ...r, lastPluckMidi: lp }))
    }

    // --- String highlight / pluck feedback (state for StringField) ---
    // A pointer (mouse/touch) hold keeps its string lit: hover state is rebuilt
    // per-frame from detected hands, so without merging the held course the
    // first hand-free frame would stomp the highlight holdCourse() just set.
    const pointerHeld = holdingRef.current
    if (pointerHeld !== null && !hoverCourses.includes(pointerHeld)) {
      hoverCourses.push(pointerHeld)
    }
    const hoverKey = hoverCourses.slice().sort((a, b) => a - b).join(',')
    if (hoverKey !== lastHoverKeyRef.current) {
      lastHoverKeyRef.current = hoverKey
      setHighlightIndices(hoverCourses)
    }
    if (pluckedCourses.length > 0) {
      // Key-guarded like the hover set above: a sustained tremolo pushes the
      // same course every frame, and an unguarded fresh array would defeat
      // StringField's memo at full frame rate.
      const pluckedKey = pluckedCourses.slice().sort((a, b) => a - b).join(',')
      if (pluckedKey !== lastPluckedKeyRef.current) {
        lastPluckedKeyRef.current = pluckedKey
        setPluckedIndices(pluckedCourses)
      }
      pluckClearRef.current = frameCounterRef.current + PLUCK_GLOW_FRAMES
    } else if (frameCounterRef.current >= pluckClearRef.current && lastPluckedKeyRef.current !== '') {
      setPluckedIndices([])
      lastPluckedKeyRef.current = ''
    }

    // --- Overlay drawing (thumb cursor + pinch-state dots) ---
    // The THUMB is the cursor, so it wears the prominent ring and carries the
    // mode colour: white = pluck (index pinch), cyan + gentle pulse = tremolo
    // (middle pinch), bone-white = idle/aiming. The index and middle tips wear
    // small dots that just show the pinch state — the engaging finger's dot
    // lights in its mode colour. The canvas shares the video's CSS scaleX(-1),
    // so we draw in raw coords. Strictly after the audio path so canvas work
    // never delays a pluck.
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.shadowColor = OVERLAY_SHADOW
      ctx.shadowBlur = OVERLAY_SHADOW_BLUR
      // Gentle pulse for an engaged tremolo — the circle "breathes" so it reads as alive.
      const trillPulse = 1.5 * Math.sin(frameCounterRef.current * 0.4)
      const drawCircle = (tip: NormPoint, radius: number, color: string, lit: boolean, pulse: boolean): void => {
        const { x, y } = projectPoint({ p: tip, width: w, height: h, mirror: false })
        const r = Math.max(3, pulse ? radius + trillPulse : radius)
        ctx.strokeStyle = color
        ctx.lineWidth = lit ? 2.5 : 1.4
        ctx.globalAlpha = lit ? 1 : 0.6
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.stroke()
        if (lit) {
          // Soft fill so the engaged finger reads at a glance.
          ctx.globalAlpha = 0.22
          ctx.fillStyle = color
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      playTips.forEach(({ indexPoint, middlePoint, thumbPoint, mode }) => {
        // Small, FIXED-size ring (no longer scales with hand distance): the ring is
        // purely visual — selection always uses the thumb cursor — so a ring that
        // balloons when the hand is near the camera only obscures which string
        // you're on. A steady small ring reads as a precise pointer. Sized to the
        // canvas resolution only.
        const radius = Math.max(5, Math.min(10, w * 0.008))
        const dotRadius = Math.max(2, radius * 0.3)
        // THUMB = the cursor: the prominent ring, carrying the mode colour.
        const thumbColor = mode === 'index' ? PLUCK_RING_COLOR : mode === 'middle' ? TRILL_RING_COLOR : PLAY_RING_COLOR
        drawCircle(thumbPoint, radius, thumbColor, mode !== 'none', mode === 'middle')
        // Index/middle are no longer pointers — tiny pinch-state dots at the
        // visual fingertips; the finger currently engaging lights in its mode colour.
        drawCircle(indexPoint, dotRadius, mode === 'index' ? PLUCK_RING_COLOR : PLAY_RING_COLOR, mode === 'index', false)
        drawCircle(middlePoint, dotRadius, mode === 'middle' ? TRILL_RING_COLOR : PLAY_RING_COLOR, mode === 'middle', mode === 'middle')
      })
      // Reset shadow so the next frame's clearRect / draws aren't haloed twice.
      ctx.shadowColor = 'rgba(0, 0, 0, 0)'
      ctx.shadowBlur = 0
    }

    scheduleNext()
  }, [videoRef, canvasRef, emitMidi])

  // Shared by start() and stop() so the two can't drift apart: a Stop→Start
  // cycle must not inherit stale gesture state (e.g. a One-Euro timestamp that
  // would spike the derivative and misfire on the first frame back).
  const resetGestureState = useCallback((): void => {
    indexPlayRef.current.forEach((d) => d.reset())
    activeFingerRef.current = ['none', 'none']
    strumPrevXRef.current = [null, null]
    strumEnableAtRef.current = [0, 0]
    strumVelocityRef.current = [STRUM_FALLBACK_VELOCITY, STRUM_FALLBACK_VELOCITY]
    lastCourseRef.current = [null, null]
    fingerFiltersRef.current.forEach((f) => f.reset())
    sustainCourseRef.current = [null, null]
    lastHoldKeyRef.current = ''
    lastHoverKeyRef.current = ''
    lastPluckedKeyRef.current = ''
    // Any pointer hold dies with the session too (stop() calls holdStop).
    holdingRef.current = null
    handGraceRef.current = 0
    lastHandTrackingRef.current = false
    setHighlightIndices([])
    setPluckedIndices([])
    setHandTracking(false)
  }, [])

  const start = useCallback(async (): Promise<void> => {
    // 'no-camera' is re-entrant: it's the "retry camera" path. Only an
    // already-running camera or an in-flight start should short-circuit.
    if (status === 'running' || status === 'loading') return
    setErrorMsg(null)
    setStatus('loading')
    // Audio is the one hard requirement — this user gesture unlocks it. If even
    // that fails the instrument is mute, so surface a blocking error to retry.
    try {
      await ensureAudioEngine()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
      return
    }
    // The camera only adds hand tracking. If it's denied/unavailable — or the
    // tracking model can't load — fall through to a fully playable 'no-camera'
    // state (mouse + keyboard) instead of blocking the instrument behind the cover.
    try {
      if (!landmarkerRef.current) landmarkerRef.current = await loadHandLandmarker()
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) throw new Error('Video/canvas element missing')
      const { width, height } = await startCamera({ video })
      canvas.width = width
      canvas.height = height
      resetGestureState()
      frameCounterRef.current = 0
      pluckClearRef.current = 0
      runningRef.current = true
      setErrorMsg(null)
      setStatus('running')
      frameHandleRef.current = scheduleVideoFrame({ video, callback: tick })
    } catch (err) {
      runningRef.current = false
      setErrorMsg(describeCameraError(err))
      setStatus('no-camera')
    }
  }, [status, videoRef, canvasRef, tick, ensureAudioEngine, resetGestureState])

  const stop = useCallback((): void => {
    runningRef.current = false
    frameHandleRef.current?.cancel()
    frameHandleRef.current = null
    stopCamera({ video: videoRef.current })
    resetGestureState()
    // Stop any ringing rashsh so Stop→Start is clean.
    audioRef.current?.holdStop()
    // Clear any lingering overlay ring.
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setStatus('idle')
  }, [videoRef, canvasRef, resetGestureState])

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


  // Ghammāz upper-jins options for the active lower jins; the selected upper is
  // lit. Memoized so UpperJinsSwitcher's memo() holds across per-frame renders.
  const upperJinsOptions = useMemo(() => upperOptions(lowerJins, upperJins), [lowerJins, upperJins])

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
    detuneCents,
    highlightIndices,
    pluckedIndices,
    handTracking,
    start,
    stop,
    setTonic,
    setDetuneCents,
    lowerJins,
    upperJins,
    homeDegree,
    ghammazLabel,
    ghammazDegree,
    setLowerJins,
    setUpperJins,
    upperJinsOptions,
    modMode,
    setModMode,
    stepMandal,
    setMandalAt,
    resetMandals,
    pluckCourse,
    glideCourse,
    holdCourse,
    releaseHold,
    // P4a: recording
    recordingState,
    recordingElapsedDisplay,
    startRecording,
    stopRecording,
    cancelRecording,
    tremoloHz,
    setTremoloHz,
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
