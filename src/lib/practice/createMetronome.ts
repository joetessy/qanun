import * as ToneNamespace from 'tone'
import { BPM_MAX, BPM_MIN, tapTempoBpm } from './tapTempo'

// Frequencies of the synthesised fallback click (used when no .wav files are
// loaded). Higher pitch = downbeat, lower = offbeat. Plenty distinguishable
// without sounding clinical.
const CLICK_HI_HZ = 2000
const CLICK_LO_HZ = 1200
const CLICK_DECAY_S = 0.03
// 4/4 only in v1 — beat 1 of every group of 4 is the downbeat.
const BEATS_PER_BAR = 4

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value))

export interface ClickInfo {
  time: number
  isDownbeat: boolean
}

export interface MetronomeOptions {
  Tone?: typeof ToneNamespace
  output: ToneNamespace.ToneAudioNode
  initialBpm: number
  initialGain?: number
  // Side-effect hook fired on every scheduled tick. The real implementation
  // uses this to trigger an audible click; tests use it to assert scheduling.
  onClick?: (info: ClickInfo) => void
  // rampTo time (seconds) for gain updates.
  gainRamp?: number
}

export interface MetronomeEngine {
  setEnabled: (enabled: boolean) => Promise<void>
  setBpm: (bpm: number) => void
  setGain: (value: number) => void
  tap: (atMs?: number) => void
  dispose: () => void
  readonly enabled: boolean
  readonly bpm: number
  readonly gain: number
}

export const createMetronome = ({
  Tone = ToneNamespace,
  output,
  initialBpm,
  initialGain = 0.4,
  onClick,
  gainRamp = 0.05
}: MetronomeOptions): MetronomeEngine => {
  const transport = Tone.getTransport()
  let enabled = false
  let targetGain = clamp(initialGain, 0, 1)
  let bpm = clamp(initialBpm, BPM_MIN, BPM_MAX)
  let beatIdx = 0
  let scheduledId: number | null = null
  const tapBuffer: number[] = []

  transport.bpm.value = bpm

  // Output gain bus for the click. Starts at 0 — ramped on enable.
  const gain = new Tone.Gain(0)
  gain.connect(output)

  const playClick = (time: number, isDownbeat: boolean): void => {
    // Synthesised fallback click: short osc → exponential gain envelope.
    // `Tone.now()` is not used — `time` comes from the Transport callback
    // and is the precise scheduled audio-context time.
    const freq = isDownbeat ? CLICK_HI_HZ : CLICK_LO_HZ
    const osc = new Tone.Oscillator({ type: 'sine', frequency: freq })
    const env = new Tone.Gain(0)
    osc.connect(env)
    env.connect(gain)
    osc.start(time)
    env.gain.setValueAtTime(1, time)
    env.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DECAY_S)
    osc.stop(time + CLICK_DECAY_S + 0.01)
    // Dispose after the click is over to avoid leaking nodes.
    setTimeout(() => {
      try {
        osc.dispose()
        env.dispose()
      } catch {
        // Already disposed.
      }
    }, (CLICK_DECAY_S + 0.05) * 1000)
  }

  const tickCallback = (time: number): void => {
    const isDownbeat = beatIdx % BEATS_PER_BAR === 0
    beatIdx = (beatIdx + 1) % BEATS_PER_BAR
    onClick?.({ time, isDownbeat })
    playClick(time, isDownbeat)
  }

  const setBpm = (next: number): void => {
    bpm = clamp(next, BPM_MIN, BPM_MAX)
    transport.bpm.value = bpm
  }

  const setGain = (value: number): void => {
    targetGain = clamp(value, 0, 1)
    if (enabled) gain.gain.rampTo(targetGain, gainRamp)
  }

  const setEnabled = async (next: boolean): Promise<void> => {
    if (enabled === next) return
    enabled = next
    if (enabled) {
      try {
        await Tone.start()
      } catch {
        // Audio context already started — ignore.
      }
      // Bail if a setEnabled(false) raced past us during the await.
      if (!enabled) return
      beatIdx = 0
      scheduledId = transport.scheduleRepeat(tickCallback, '4n')
      transport.start()
      gain.gain.rampTo(targetGain, gainRamp)
    } else {
      if (scheduledId !== null) {
        transport.clear(scheduledId)
        scheduledId = null
      }
      // Do NOT stop the global transport — the rashsh sustain loop runs on it too,
      // so stopping here would cut off a held note. Just unschedule + fade out.
      gain.gain.rampTo(0, gainRamp)
    }
  }

  // Records a tap timestamp and, if at least two taps are in the buffer,
  // updates BPM to the tap-tempo median. Keeps only the last 8 taps so
  // `tapTempoBpm` can slice the last 4 intervals.
  const tap = (atMs: number = performance.now()): void => {
    tapBuffer.push(atMs)
    if (tapBuffer.length > 8) tapBuffer.splice(0, tapBuffer.length - 8)
    const next = tapTempoBpm(tapBuffer)
    if (next !== null) setBpm(next)
  }

  const dispose = (): void => {
    if (scheduledId !== null) {
      transport.clear(scheduledId)
      scheduledId = null
    }
    if (enabled) {
      transport.stop()
      enabled = false
    }
    gain.dispose()
  }

  return {
    setEnabled,
    setBpm,
    setGain,
    tap,
    dispose,
    get enabled() {
      return enabled
    },
    get bpm() {
      return bpm
    },
    get gain() {
      return targetGain
    }
  }
}
