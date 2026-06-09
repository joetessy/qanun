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
  // MediaPipe sometimes labels two detected hands the SAME (both "Right"), which
  // would leave one role empty and let only one hand play. When two hands are
  // present, make sure both get a role: drop the unassigned hand into the empty
  // slot. The two roles are symmetric (both just play), so the exact L/R label
  // doesn't matter — what matters is that both hands are usable.
  if (result.handedness.length >= 2) {
    if (rightHandIdx === -1) rightHandIdx = leftHandIdx === 0 ? 1 : 0
    else if (leftHandIdx === -1) leftHandIdx = rightHandIdx === 0 ? 1 : 0
  }
  return { rightHandIdx, leftHandIdx }
}
