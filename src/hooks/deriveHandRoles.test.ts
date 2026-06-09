import { describe, expect, it } from 'vitest'
import { deriveHandRoles } from './deriveHandRoles'

// Right hand plays only; left hand plays AND modulates (when in the mandal zone).
describe('deriveHandRoles', () => {
  it('assigns both hands to play when neither is in the mandal zone', () => {
    const roles = deriveHandRoles({ rightHandIdx: 0, leftHandIdx: 1, leftHandX: 0.5 })
    expect(roles.playHands).toEqual([0, 1])
    expect(roles.mandalHandIdx).toBeNull()
  })

  it('routes the left hand to mandal mode when it is in the zone', () => {
    const roles = deriveHandRoles({ rightHandIdx: 0, leftHandIdx: 1, leftHandX: 0.05 })
    expect(roles.mandalHandIdx).toBe(1)
    expect(roles.playHands).toEqual([0]) // left hand no longer plays while modulating
  })

  it('handles a missing hand (idx -1)', () => {
    const roles = deriveHandRoles({ rightHandIdx: -1, leftHandIdx: 1, leftHandX: 0.5 })
    expect(roles.playHands).toEqual([1])
    expect(roles.mandalHandIdx).toBeNull()
  })

  it('no left hand → no mandal control', () => {
    const roles = deriveHandRoles({ rightHandIdx: 0, leftHandIdx: -1, leftHandX: 0.05 })
    expect(roles.mandalHandIdx).toBeNull()
    expect(roles.playHands).toEqual([0])
  })
})
