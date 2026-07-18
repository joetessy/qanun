import * as ToneNamespace from 'tone'
import { midiToFreq } from '../music/midiToFreq'
import { clamp01 } from '../music/clamp01'

export interface DroneOptions {
  // Injectable Tone namespace so tests can stub it. Defaults to the real `tone`.
  Tone?: typeof ToneNamespace
  // Destination node (typically the audio engine's sumBus).
  output: ToneNamespace.ToneAudioNode
  initialTonicMidi: number
  // Default gain (0–1) applied when the drone is enabled. UI overrides via setGain.
  initialGain?: number
  // rampTo time (seconds) for frequency updates.
  freqRamp?: number
  // rampTo time (seconds) for gain updates.
  gainRamp?: number
}

export interface DroneEngine {
  setEnabled: (enabled: boolean) => Promise<void>
  setTonic: (midi: number) => void
  setGain: (value: number) => void
  dispose: () => void
  readonly enabled: boolean
  readonly gain: number
}

export const createDrone = ({
  Tone = ToneNamespace,
  output,
  initialTonicMidi,
  initialGain = 0.25,
  freqRamp = 0.05,
  gainRamp = 0.08
}: DroneOptions): DroneEngine => {
  let enabled = false
  let started = false
  let targetGain = clamp01(initialGain)

  // Allocate the chain: osc → gain → output. Gain starts at 0 so we don't
  // hear anything until setEnabled(true).
  const gain = new Tone.Gain(0)
  gain.connect(output)
  const osc = new Tone.Oscillator({ type: 'sine', frequency: midiToFreq(initialTonicMidi) })
  osc.connect(gain)
  // Ensure the initial freq value is recorded via rampTo for tests/observability.
  osc.frequency.rampTo(midiToFreq(initialTonicMidi), freqRamp)

  const setGain = (value: number): void => {
    targetGain = clamp01(value)
    if (enabled) gain.gain.rampTo(targetGain, gainRamp)
  }

  const setTonic = (midi: number): void => {
    const hz = midiToFreq(midi)
    if (!Number.isFinite(hz) || hz <= 0) return
    osc.frequency.rampTo(hz, freqRamp)
  }

  const setEnabled = async (next: boolean): Promise<void> => {
    if (enabled === next) return
    enabled = next
    if (enabled) {
      if (!started) {
        // Tone.start() unlocks the audio context (idempotent if already running).
        try {
          await Tone.start()
        } catch {
          // Audio context may already be running — ignore.
        }
        // Bail if a setEnabled(false) raced past us during the await.
        if (!enabled) return
        osc.start()
        started = true
      }
      gain.gain.rampTo(targetGain, gainRamp)
    } else {
      gain.gain.rampTo(0, gainRamp)
    }
  }

  const dispose = (): void => {
    try {
      if (started) osc.stop()
    } catch {
      // Already stopped — ignore.
    }
    osc.dispose()
    gain.dispose()
  }

  return {
    setEnabled,
    setTonic,
    setGain,
    dispose,
    get enabled() {
      return enabled
    },
    get gain() {
      return targetGain
    }
  }
}
