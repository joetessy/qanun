import { useCallback, useEffect, useRef, useState } from 'react'
import { createMidiOut, type MidiOutEngine, type MidiSupportState, type MidiOutputInfo } from '../lib/midi/createMidiOut'

export interface UseMidiOut {
  midiEnabled: boolean
  setMidiEnabled: (b: boolean) => Promise<void>
  midiSupport: MidiSupportState
  midiOutputs: readonly MidiOutputInfo[]
  midiOutputId: string | null
  setMidiOutputId: (id: string | null) => void
  midiBendRange: number
  setMidiBendRange: (semitones: number) => void
  /**
   * Fire-and-forget MIDI note emission — called alongside every audio.pluck()
   * when MIDI is enabled. STABLE identity (empty dep array; reads the enabled
   * flag from a ref) so the hot frame loop and soundCourse can list it in their
   * dep arrays without churning. A mid-session toggle takes effect immediately.
   */
  emitMidi: (freqHz: number, velocity: number) => void
}

// P4b: microtonal MIDI out (off by default). Owns the MIDI engine lifecycle and
// disposes it on unmount; entirely independent of the audio engine.
export const useMidiOut = (): UseMidiOut => {
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

  const emitMidi = useCallback((freqHz: number, velocity: number): void => {
    if (!midiEnabledRef.current) return
    midiRef.current?.playNote({ freqHz, velocity })
  }, [])

  useEffect(() => () => { midiRef.current?.dispose() }, [])

  return {
    midiEnabled,
    setMidiEnabled,
    midiSupport,
    midiOutputs,
    midiOutputId,
    setMidiOutputId,
    midiBendRange,
    setMidiBendRange,
    emitMidi
  }
}
