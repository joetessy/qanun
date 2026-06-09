import { describe, expect, it } from 'vitest'
import { deriveHandRoles } from './deriveHandRoles'

describe('deriveHandRoles', () => {
  it('both detected hands play; no mandal hand', () => {
    expect(deriveHandRoles({ rightHandIdx: 0, leftHandIdx: 1 })).toEqual({ playHands: [0, 1] })
  })
  it('right only', () => {
    expect(deriveHandRoles({ rightHandIdx: 0, leftHandIdx: -1 })).toEqual({ playHands: [0] })
  })
  it('left only', () => {
    expect(deriveHandRoles({ rightHandIdx: -1, leftHandIdx: 2 })).toEqual({ playHands: [2] })
  })
  it('neither', () => {
    expect(deriveHandRoles({ rightHandIdx: -1, leftHandIdx: -1 })).toEqual({ playHands: [] })
  })
})
