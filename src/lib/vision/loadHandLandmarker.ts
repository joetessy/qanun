// Dynamic import keeps @mediapipe/tasks-vision out of the initial bundle.
// The 3–4 MB vision library only loads when the user presses "play" to start
// hand-tracking; the mouse-play path works without it.

import type { HandLandmarker } from '@mediapipe/tasks-vision'

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export const loadHandLandmarker = async (): Promise<HandLandmarker> => {
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    // Classical theremin mapping: right hand = pitch + pinch gate, left hand = volume.
    numHands: 2,
    // Lower detection = faster re-acquisition when a hand returns to frame.
    minHandDetectionConfidence: 0.4,
    // High presence threshold = snappy release when a hand exits, so the
    // audio gate / volume drop without a hold-over.
    minHandPresenceConfidence: 0.75,
    minTrackingConfidence: 0.4
  })
}
