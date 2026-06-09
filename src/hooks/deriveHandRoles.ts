import { isInMandalZone } from '../lib/gesture/detectMandal'

export interface HandRolesArgs {
  rightHandIdx: number  // -1 if absent
  leftHandIdx: number   // -1 if absent
  leftHandX: number     // mirrored screen x of the left hand's index tip
}

export interface HandRoles {
  playHands: number[]        // landmark indices that pluck this frame
  mandalHandIdx: number | null // landmark index controlling the mandal rack, or null
}

// Right hand plays only. Left hand plays — unless it's in the mandal zone, in
// which case it switches to modulating and stops plucking (clear separation,
// mirrors the real instrument's geography).
export const deriveHandRoles = ({ rightHandIdx, leftHandIdx, leftHandX }: HandRolesArgs): HandRoles => {
  const playHands: number[] = []
  if (rightHandIdx !== -1) playHands.push(rightHandIdx)

  let mandalHandIdx: number | null = null
  if (leftHandIdx !== -1) {
    if (isInMandalZone(leftHandX)) {
      mandalHandIdx = leftHandIdx
    } else {
      playHands.push(leftHandIdx)
    }
  }
  return { playHands, mandalHandIdx }
}
