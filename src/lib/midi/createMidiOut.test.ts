import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMidiOut } from './createMidiOut'
import { midiToFreq } from '../music/midiToFreq'

// ---------------------------------------------------------------------------
// Helpers to build a mock Web MIDI environment.
// ---------------------------------------------------------------------------

interface FakeOutput {
  id: string
  name: string
  calls: Array<{ data: number[]; timestamp?: number }>
  send: (data: number[], ts?: number) => void
}

const makeOutput = (id = 'out1', name = 'Test Output'): FakeOutput => {
  const calls: Array<{ data: number[]; timestamp?: number }> = []
  return {
    id,
    name,
    calls,
    send: (data, ts) => calls.push({ data, timestamp: ts })
  }
}

const makeAccess = (outputs: FakeOutput[] = []) => {
  const map = new Map<string, FakeOutput>(outputs.map((o) => [o.id, o]))
  return {
    outputs: map,
    onstatechange: null as (() => void) | null
  }
}

const makeNav = (outputs: FakeOutput[] = [], deny = false) => ({
  requestMIDIAccess: vi.fn(async () => {
    if (deny) throw new Error('denied')
    return makeAccess(outputs)
  })
})

// A scheduleNoteOff that synchronously stores calls so we can inspect them.
const syncNoteOffCapture = () => {
  const pending: Array<() => void> = []
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const schedule = (fn: () => void, _ms: number): void => { pending.push(fn) }
  const flush = (): void => { pending.splice(0).forEach((fn) => fn()) }
  return { schedule, flush }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createMidiOut', () => {
  describe('support state', () => {
    it('is "unsupported" when requestMIDIAccess is absent', () => {
      const engine = createMidiOut({ navigatorObj: {} })
      expect(engine.support).toBe('unsupported')
    })

    it('is "unknown" before start() when requestMIDIAccess is present', () => {
      const engine = createMidiOut({ navigatorObj: makeNav() })
      expect(engine.support).toBe('unknown')
    })

    it('becomes "ready" after start() succeeds', async () => {
      const engine = createMidiOut({ navigatorObj: makeNav() })
      await engine.start()
      expect(engine.support).toBe('ready')
    })

    it('becomes "denied" when requestMIDIAccess rejects', async () => {
      const engine = createMidiOut({ navigatorObj: makeNav([], true) })
      await engine.start()
      expect(engine.support).toBe('denied')
    })

    it('start() is idempotent — second call does nothing', async () => {
      const nav = makeNav()
      const engine = createMidiOut({ navigatorObj: nav })
      await engine.start()
      await engine.start()
      expect(nav.requestMIDIAccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('outputs', () => {
    it('empty before start()', () => {
      const engine = createMidiOut({ navigatorObj: makeNav([makeOutput()]) })
      expect(engine.outputs).toHaveLength(0)
    })

    it('populated after start()', async () => {
      const engine = createMidiOut({ navigatorObj: makeNav([makeOutput('o1', 'Synth')]) })
      await engine.start()
      expect(engine.outputs).toHaveLength(1)
      expect(engine.outputs[0].id).toBe('o1')
      expect(engine.outputs[0].name).toBe('Synth')
    })
  })

  describe('playNote — no output selected', () => {
    it('is a no-op when no output is set', async () => {
      const out = makeOutput()
      const engine = createMidiOut({ navigatorObj: makeNav([out]) })
      await engine.start()
      // Do NOT call setOutput — output is null.
      engine.playNote({ freqHz: 440, velocity: 0.8 })
      expect(out.calls).toHaveLength(0)
    })
  })

  describe('playNote — with output selected', () => {
    let out: FakeOutput
    let engine: ReturnType<typeof createMidiOut>
    let noteOffCapture: ReturnType<typeof syncNoteOffCapture>

    beforeEach(async () => {
      out = makeOutput()
      noteOffCapture = syncNoteOffCapture()
      engine = createMidiOut({
        navigatorObj: makeNav([out]),
        scheduleNoteOff: noteOffCapture.schedule
      })
      await engine.start()
      engine.setOutput('out1')
    })

    it('emits pitch-bend before note-on', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      expect(out.calls).toHaveLength(2)
      const [bendMsg, noteOnMsg] = out.calls
      // Pitch bend status: 0xE0 | channel (first MPE channel = 1 → 0xE0)
      expect((bendMsg.data[0] & 0xf0)).toBe(0xe0)
      // Note-on status: 0x90 | channel
      expect((noteOnMsg.data[0] & 0xf0)).toBe(0x90)
      // Note on channel 1 (0-indexed 0)
      expect((noteOnMsg.data[0] & 0x0f)).toBe(0)
    })

    it('A4 440 Hz → pitch-bend = 8192 (center)', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      const [bendMsg] = out.calls
      const lsb = bendMsg.data[1]
      const msb = bendMsg.data[2]
      const bend14 = lsb | (msb << 7)
      expect(bend14).toBe(8192)
    })

    it('quarter-tone note produces non-center pitch-bend', () => {
      // MIDI 69.5 is a quarter-tone above A4.
      const freqHz = midiToFreq(69.5)
      engine.playNote({ freqHz, velocity: 0.7 })
      const [bendMsg] = out.calls
      const lsb = bendMsg.data[1]
      const msb = bendMsg.data[2]
      const bend14 = lsb | (msb << 7)
      expect(bend14).not.toBe(8192)
    })

    it('note-on carries the nearest integer MIDI note', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      const [, noteOnMsg] = out.calls
      expect(noteOnMsg.data[1]).toBe(69) // A4
    })

    it('velocity maps 0..1 → 1..127', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      const [, noteOnMsg] = out.calls
      expect(noteOnMsg.data[2]).toBe(127)
    })

    it('velocity 0.5 → ~64', () => {
      engine.playNote({ freqHz: 440, velocity: 0.5 })
      const [, noteOnMsg] = out.calls
      expect(noteOnMsg.data[2]).toBeCloseTo(64, 0)
    })

    it('schedules a note-off after the note-on', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      expect(out.calls).toHaveLength(2)
      noteOffCapture.flush()
      expect(out.calls).toHaveLength(3)
      expect((out.calls[2].data[0] & 0xf0)).toBe(0x80) // note-off
    })

    it('note-off targets the same channel and note as note-on', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      noteOffCapture.flush()
      const noteOnCh = out.calls[1].data[0] & 0x0f
      const noteOffCh = out.calls[2].data[0] & 0x0f
      expect(noteOffCh).toBe(noteOnCh)
      expect(out.calls[2].data[1]).toBe(out.calls[1].data[1]) // same note
    })

    it('successive calls use different MPE channels (round-robin)', () => {
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      const ch1 = out.calls[1].data[0] & 0x0f  // note-on 1
      const ch2 = out.calls[3].data[0] & 0x0f  // note-on 2
      expect(ch1).not.toBe(ch2)
    })
  })

  describe('setBendRange', () => {
    it('larger bend range makes quarter-tone bend land closer to center', async () => {
      const out1 = makeOutput('o1')
      const out2 = makeOutput('o2')
      const noteOff = syncNoteOffCapture()
      const narrowEngine = createMidiOut({ navigatorObj: makeNav([out1]), scheduleNoteOff: noteOff.schedule })
      const wideEngine = createMidiOut({ navigatorObj: makeNav([out2]), scheduleNoteOff: noteOff.schedule })
      await narrowEngine.start()
      await wideEngine.start()
      narrowEngine.setOutput('o1')
      wideEngine.setOutput('o2')
      narrowEngine.setBendRange(2)
      wideEngine.setBendRange(48)

      const freqHz = midiToFreq(69.5) // quarter-tone above A4
      narrowEngine.playNote({ freqHz, velocity: 0.7 })
      wideEngine.playNote({ freqHz, velocity: 0.7 })

      const narrowBend = (out1.calls[0].data[1] | (out1.calls[0].data[2] << 7))
      const wideBend = (out2.calls[0].data[1] | (out2.calls[0].data[2] << 7))
      // Wide range → bend deviation is smaller relative to center
      expect(Math.abs(wideBend - 8192)).toBeLessThan(Math.abs(narrowBend - 8192))
    })
  })

  describe('onOutputsChange hotplug', () => {
    it('fires onOutputsChange when onstatechange fires', async () => {
      const out = makeOutput('o1', 'Synth')
      const access = makeAccess([out])
      const nav = { requestMIDIAccess: vi.fn(async () => access) }
      const onChange = vi.fn()
      const engine = createMidiOut({ navigatorObj: nav, onOutputsChange: onChange })
      await engine.start()
      // Called once during start() → initial refreshOutputs
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toHaveLength(1)
      // Simulate a device connect/disconnect hotplug event
      onChange.mockClear()
      access.onstatechange?.()
      expect(onChange).toHaveBeenCalledTimes(1)
      // The outputs list is passed to the callback
      expect(onChange.mock.calls[0][0][0].id).toBe('o1')
    })
  })

  describe('stop / dispose', () => {
    it('stop() clears output; subsequent playNote is a no-op', async () => {
      const out = makeOutput()
      const noteOff = syncNoteOffCapture()
      const engine = createMidiOut({ navigatorObj: makeNav([out]), scheduleNoteOff: noteOff.schedule })
      await engine.start()
      engine.setOutput('out1')
      engine.stop()
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      expect(out.calls).toHaveLength(0)
    })

    it('dispose() is equivalent to stop()', async () => {
      const out = makeOutput()
      const engine = createMidiOut({ navigatorObj: makeNav([out]) })
      await engine.start()
      engine.setOutput('out1')
      engine.dispose()
      engine.playNote({ freqHz: 440, velocity: 1.0 })
      expect(out.calls).toHaveLength(0)
    })
  })
})
