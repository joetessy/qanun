import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

export interface HandednessIndices {
  rightHandIdx: number
  leftHandIdx: number
}

// MediaPipe handedness is from the camera's POV (unmirrored frame). For a
// user-facing camera that means MediaPipe "Right" = user's right hand.
export const findHandedness = ({
  result
}: {
  result: HandLandmarkerResult
}): HandednessIndices => {
  let rightHandIdx = -1
  let leftHandIdx = -1
  for (let i = 0; i < result.handedness.length; i++) {
    const label = result.handedness[i]?.[0]?.categoryName
    if (label === 'Right' && rightHandIdx === -1) rightHandIdx = i
    else if (label === 'Left' && leftHandIdx === -1) leftHandIdx = i
  }
  return { rightHandIdx, leftHandIdx }
}
