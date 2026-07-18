// Web-only microtonal MIDI output engine.
// Sends pitch-bend + note-on per pluck on round-robin MPE member channels.
// No native deps — works in any browser that supports navigator.requestMIDIAccess.

import { freqToNoteBend, bendToPitchBend14, nextMpeChannel } from './microtonal'
import { clamp } from '../math/clamp'

// ---------------------------------------------------------------------------
// Minimal Web MIDI API typings (avoids relying on TS lib having them).
// ---------------------------------------------------------------------------

interface MidiOutputLike {
  id: string
  name?: string | null
  send: (data: number[], timestamp?: number) => void
}

interface MidiAccessLike {
  outputs: Map<string, MidiOutputLike>
  onstatechange: (() => void) | null
}

interface NavigatorWithMidi {
  requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<MidiAccessLike>
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MidiSupportState = 'unknown' | 'unsupported' | 'denied' | 'ready'

export interface MidiOutputInfo {
  id: string
  name: string
}

export interface MidiOutEngine {
  /** Request MIDI access; populates outputs, updates support. */
  start(): Promise<void>
  /** Select an output by id (pass null to deselect). */
  setOutput(id: string | null): void
  /** Set the pitch-bend range in semitones (default 2). */
  setBendRange(semitones: number): void
  /** Send pitch-bend + note-on for the given frequency + velocity. */
  playNote(args: { freqHz: number; velocity: number }): void
  /** Current support state. */
  readonly support: MidiSupportState
  /** Available MIDI outputs. */
  readonly outputs: readonly MidiOutputInfo[]
  /** Release MIDI access resources. */
  stop(): void
  /** Alias for stop() — matches the lifecycle pattern in the hook. */
  dispose(): void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_NOTE_ON = 0x90
const STATUS_NOTE_OFF = 0x80
const STATUS_PITCH_BEND = 0xe0

/** Duration in ms before an automatic note-off fires. */
const NOTE_OFF_DELAY_MS = 600

/** MPE member channels: 1..15 (channel 16 is reserved as the MPE master). */
const MPE_CHANNELS = Array.from({ length: 15 }, (_, i) => i + 1)

const clampMidi = (v: number): number => clamp(Math.round(v), 0, 127)
const clampVelocity = (v: number): number => clamp(Math.round(v * 127), 1, 127)

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface MidiOutOptions {
  /** Injectable navigator-like object (for tests). */
  navigatorObj?: NavigatorWithMidi
  /** Injectable setTimeout (for tests — lets you control note-off timing). */
  scheduleNoteOff?: (fn: () => void, ms: number) => void
  /** Called whenever the available MIDI outputs list changes (device connect/disconnect). */
  onOutputsChange?: (outputs: readonly MidiOutputInfo[]) => void
}

export const createMidiOut = (opts: MidiOutOptions = {}): MidiOutEngine => {
  const nav: NavigatorWithMidi = opts.navigatorObj ?? (navigator as unknown as NavigatorWithMidi)
  const scheduleNoteOff = opts.scheduleNoteOff ?? ((fn, ms) => { setTimeout(fn, ms) })
  const onOutputsChange = opts.onOutputsChange

  let support: MidiSupportState = typeof nav.requestMIDIAccess === 'function' ? 'unknown' : 'unsupported'
  let access: MidiAccessLike | null = null
  let outputId: string | null = null
  let output: MidiOutputLike | null = null
  let bendRange = 2
  let outputsCache: MidiOutputInfo[] = []
  let lastChannel = MPE_CHANNELS[MPE_CHANNELS.length - 1] // nextMpeChannel will return [0]
  // Note still sounding on each (0-indexed) member channel. A fast strum can
  // rotate through all 15 channels inside the note-off window, and pitch bend
  // is channel-wide — so a reused channel must cut its previous note first or
  // the new bend retunes the old note's ringing tail. `gen` invalidates the
  // superseded note's scheduled note-off.
  const activeNotes = new Map<number, { note: number; gen: number }>()
  let noteGen = 0

  const refreshOutputs = (): void => {
    if (!access) { outputsCache = []; return }
    const next: MidiOutputInfo[] = []
    access.outputs.forEach((port) => {
      next.push({ id: port.id, name: port.name ?? '(unnamed)' })
    })
    outputsCache = next
    // If the selected output vanished, deselect it.
    if (outputId !== null && !outputsCache.some((o) => o.id === outputId)) {
      outputId = null
      output = null
    }
    // Notify the caller so the UI can update on hotplug events.
    onOutputsChange?.(outputsCache)
  }

  const send = (bytes: number[]): void => {
    if (!output) return
    try { output.send(bytes) } catch { /* swallow — never crash audio path */ }
  }

  // -------------------------------------------------------------------------

  const start = async (): Promise<void> => {
    if (support === 'unsupported') return
    if (access) return // already started
    try {
      access = await nav.requestMIDIAccess!({ sysex: false })
    } catch {
      support = 'denied'
      return
    }
    support = 'ready'
    access.onstatechange = (): void => { refreshOutputs() }
    refreshOutputs()
    // Re-resolve the selected output, if any.
    if (outputId && access) {
      output = access.outputs.get(outputId) ?? null
    }
  }

  const setOutput = (id: string | null): void => {
    outputId = id
    if (!access || id === null) { output = null; return }
    output = access.outputs.get(id) ?? null
  }

  const setBendRange = (semitones: number): void => {
    bendRange = Math.max(1, Math.round(semitones))
  }

  const playNote = ({ freqHz, velocity }: { freqHz: number; velocity: number }): void => {
    if (!output) return

    // Pick next round-robin MPE channel.
    const channel = nextMpeChannel(lastChannel, MPE_CHANNELS)
    lastChannel = channel
    const ch = channel - 1  // 0-indexed for MIDI status bytes

    // Compute note + bend.
    const { note, bendCents } = freqToNoteBend(freqHz)
    const bend14 = bendToPitchBend14(bendCents, bendRange)

    // Cut whatever is still sounding on this channel before retuning it.
    const pending = activeNotes.get(ch)
    if (pending) send([STATUS_NOTE_OFF | ch, pending.note, 0])

    // Pitch-bend first, then note-on (so the synth sees the bent pitch immediately).
    send([STATUS_PITCH_BEND | ch, bend14 & 0x7f, (bend14 >> 7) & 0x7f])
    const capturedNote = clampMidi(note)
    send([STATUS_NOTE_ON | ch, capturedNote, clampVelocity(velocity)])

    // Schedule note-off; skipped if the channel was reused in the meantime
    // (the immediate cut above already ended this note).
    const gen = ++noteGen
    activeNotes.set(ch, { note: capturedNote, gen })
    scheduleNoteOff(() => {
      if (activeNotes.get(ch)?.gen !== gen) return
      activeNotes.delete(ch)
      send([STATUS_NOTE_OFF | ch, capturedNote, 0])
    }, NOTE_OFF_DELAY_MS)
  }

  const stop = (): void => {
    // Flush sounding notes before dropping the output — their scheduled
    // note-offs can no longer send once output is null, and a sustaining
    // patch would otherwise ring forever.
    activeNotes.forEach(({ note }, ch) => {
      send([STATUS_NOTE_OFF | ch, note, 0])
    })
    activeNotes.clear()
    if (access) {
      access.onstatechange = null
      access = null
    }
    output = null
    outputId = null
  }

  return {
    start,
    setOutput,
    setBendRange,
    playNote,
    stop,
    dispose: stop,
    get support() { return support },
    get outputs() { return outputsCache }
  }
}
