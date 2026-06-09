import { describe, expect, it } from 'vitest'
import { JINS, jinsById } from './JINS'
import { reachableStartDegrees, isJinsReachable } from './reachability'

describe('jins reachability against the mandal positions', () => {
  it('EVERY jins in the P1 core is reachable', () => {
    for (const j of JINS) {
      expect(isJinsReachable(j), `${j.id} must be reachable`).toBe(true)
    }
  })

  it('roots most ajnas at degree 1', () => {
    expect(reachableStartDegrees(jinsById('rast'))).toContain(1)
    expect(reachableStartDegrees(jinsById('hijaz'))).toContain(1)
    expect(reachableStartDegrees(jinsById('nikriz'))).toContain(1) // needs degree-4 offset 6
    expect(reachableStartDegrees(jinsById('saba'))).toContain(1)   // needs degree-4 offset 4
  })

  it('can place Sikah on the half-flat 3rd degree (degree 3)', () => {
    // Sikah is also mathematically reachable from degree 1 (0, 1.5, 3.5 are all
    // legal positions); identifyAjnas uses homeDegree to keep it off degree 1.
    expect(reachableStartDegrees(jinsById('sikah'))).toContain(3)
  })
})
