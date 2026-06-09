export interface HandRolesArgs {
  rightHandIdx: number // -1 if absent
  leftHandIdx: number  // -1 if absent
}

export interface HandRoles {
  playHands: number[] // landmark indices that play this frame (both hands)
}

// Both hands play now (the mandal was retired). Each present hand becomes a
// playing hand; the engine drives one pinchPlay slot per hand.
export const deriveHandRoles = ({ rightHandIdx, leftHandIdx }: HandRolesArgs): HandRoles => {
  const playHands: number[] = []
  if (rightHandIdx !== -1) playHands.push(rightHandIdx)
  if (leftHandIdx !== -1) playHands.push(leftHandIdx)
  return { playHands }
}
