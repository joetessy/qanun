import { describe, expect, it } from 'vitest'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { findHandedness } from './findHandedness'

// Minimal result: only `handedness` is read (one category entry per hand).
const make = (labels: string[]): HandLandmarkerResult =>
  ({ handedness: labels.map((l) => [{ categoryName: l }]) }) as unknown as HandLandmarkerResult

describe('findHandedness', () => {
  it('returns -1/-1 when no hands are present', () => {
    expect(findHandedness({ result: make([]) })).toEqual({ rightHandIdx: -1, leftHandIdx: -1 })
  })

  it('assigns a single hand by its label', () => {
    expect(findHandedness({ result: make(['Right']) })).toEqual({ rightHandIdx: 0, leftHandIdx: -1 })
    expect(findHandedness({ result: make(['Left']) })).toEqual({ rightHandIdx: -1, leftHandIdx: 0 })
  })

  it('assigns two correctly-labelled hands', () => {
    expect(findHandedness({ result: make(['Right', 'Left']) })).toEqual({ rightHandIdx: 0, leftHandIdx: 1 })
    expect(findHandedness({ result: make(['Left', 'Right']) })).toEqual({ rightHandIdx: 1, leftHandIdx: 0 })
  })

  it('still assigns BOTH hands when MediaPipe mislabels them the same', () => {
    // Both "Right" → the unassigned hand fills the empty left role so both play.
    expect(findHandedness({ result: make(['Right', 'Right']) })).toEqual({ rightHandIdx: 0, leftHandIdx: 1 })
    // Both "Left" → the unassigned hand fills the empty right role.
    expect(findHandedness({ result: make(['Left', 'Left']) })).toEqual({ rightHandIdx: 1, leftHandIdx: 0 })
  })
})
