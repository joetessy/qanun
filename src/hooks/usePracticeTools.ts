import { useCallback, useEffect, useRef, useState } from 'react'
import type { QanunEngine } from '../lib/audio/createQanunEngine'
import type { DroneEngine } from '../lib/practice/createDrone'
import type { MetronomeEngine } from '../lib/practice/createMetronome'

export interface UsePracticeToolsArgs {
  // Brings the audio engine up (lazy first-gesture init) before a tool tries to
  // connect to its sumBus.
  ensureAudioEngine: () => Promise<void>
  // The live audio engine, or null before first interaction.
  getEngine: () => QanunEngine | null
  // Current home-note pitch in (fractional) MIDI — the drone follows the maqam's
  // home note carrying the global fine-tune, so it never clashes with the strings.
  getDroneTonicMidi: () => number
}

export interface UsePracticeTools {
  droneEnabled: boolean
  setDroneEnabled: (b: boolean) => void
  droneGain: number
  setDroneGain: (v: number) => void
  // Retune the drone to a new home-note pitch — called by the engine's recompute
  // whenever tonic/tuning/fine-tune changes. STABLE identity so recompute's dep
  // array stays empty. No-op until the drone is created.
  setDroneTonic: (tonicMidi: number) => void
  metronomeEnabled: boolean
  setMetronomeEnabled: (b: boolean) => void
  metronomeBpm: number
  setMetronomeBpm: (bpm: number) => void
  tapMetronome: () => void
}

// P4a: practice tools — the drone and the metronome. Both connect to the audio
// engine's sumBus, are lazily created, and are disposed on unmount.
export const usePracticeTools = ({ ensureAudioEngine, getEngine, getDroneTonicMidi }: UsePracticeToolsArgs): UsePracticeTools => {
  // Drone state (off by default).
  const [droneEnabled, setDroneEnabledState] = useState(false)
  const [droneGain, setDroneGainState] = useState(0.25)
  const droneRef = useRef<DroneEngine | null>(null)

  // Metronome state (off by default, 120 BPM default).
  const [metronomeEnabled, setMetronomeEnabledState] = useState(false)
  const [metronomeBpm, setMetronomeBpmState] = useState(120)
  // Ref that mirrors metronomeBpm so ensureMetronome can read the initial BPM
  // without taking it as a dep (which would cause callback-identity churn on
  // every BPM change before the metronome is even created).
  const metronomeBpmRef = useRef(120)
  const metronomeRef = useRef<MetronomeEngine | null>(null)

  /** Lazy-create the drone engine, connected to the sumBus. */
  const ensureDrone = useCallback(async (): Promise<DroneEngine> => {
    if (droneRef.current) return droneRef.current
    const engine = getEngine()
    if (!engine) throw new Error('Audio engine not initialised before drone')
    const { createDrone } = await import('../lib/practice/createDrone')
    if (droneRef.current) return droneRef.current // re-check: a concurrent call may have won the await
    const d = createDrone({ output: engine.sumBus, initialTonicMidi: getDroneTonicMidi() })
    droneRef.current = d
    return d
  }, [getEngine, getDroneTonicMidi])

  const setDroneEnabled = useCallback((b: boolean): void => {
    void ensureAudioEngine()
      .then(() => ensureDrone())
      .then((d) => d.setEnabled(b).then(() => setDroneEnabledState(d.enabled)))
      .catch(() => {}) // failed audio init — cached promise already cleared for retry
  }, [ensureAudioEngine, ensureDrone])

  const setDroneGain = useCallback((v: number): void => {
    setDroneGainState(v)
    droneRef.current?.setGain(v)
  }, [])

  const setDroneTonic = useCallback((tonicMidi: number): void => {
    droneRef.current?.setTonic(tonicMidi)
  }, [])

  /** Lazy-create the metronome engine, connected to the sumBus. */
  const ensureMetronome = useCallback(async (): Promise<MetronomeEngine> => {
    if (metronomeRef.current) return metronomeRef.current
    const engine = getEngine()
    if (!engine) throw new Error('Audio engine not initialised before metronome')
    const { createMetronome } = await import('../lib/practice/createMetronome')
    if (metronomeRef.current) return metronomeRef.current // re-check: a concurrent call may have won the await
    // Read BPM from the ref so this callback doesn't need metronomeBpm in its
    // dep array — that would cause identity churn on every BPM keystroke.
    const m = createMetronome({ output: engine.sumBus, initialBpm: metronomeBpmRef.current })
    metronomeRef.current = m
    return m
  }, [getEngine])

  const setMetronomeEnabled = useCallback((b: boolean): void => {
    void ensureAudioEngine()
      .then(() => ensureMetronome())
      .then((m) => m.setEnabled(b).then(() => setMetronomeEnabledState(m.enabled)))
      .catch(() => {}) // failed audio init — cached promise already cleared for retry
  }, [ensureAudioEngine, ensureMetronome])

  const setMetronomeBpm = useCallback((bpm: number): void => {
    // Guard non-numbers (an emptied/invalid number input parses to NaN/0 —
    // the engine clamps internally, but state should never hold NaN).
    if (!Number.isFinite(bpm)) return
    metronomeBpmRef.current = bpm
    setMetronomeBpmState(bpm)
    metronomeRef.current?.setBpm(bpm)
  }, [])

  const tapMetronome = useCallback((): void => {
    // Ensure engine is ready; metronome tap is fire-and-forget.
    void ensureAudioEngine()
      .then(() => ensureMetronome())
      .then((m) => {
        m.tap()
        // Sync displayed BPM after tap (tap may have updated it).
        setMetronomeBpmState(m.bpm)
      })
      .catch(() => {}) // failed audio init — cached promise already cleared for retry
  }, [ensureAudioEngine, ensureMetronome])

  useEffect(() => () => {
    droneRef.current?.dispose()
    metronomeRef.current?.dispose()
  }, [])

  return {
    droneEnabled,
    setDroneEnabled,
    droneGain,
    setDroneGain,
    setDroneTonic,
    metronomeEnabled,
    setMetronomeEnabled,
    metronomeBpm,
    setMetronomeBpm,
    tapMetronome
  }
}
