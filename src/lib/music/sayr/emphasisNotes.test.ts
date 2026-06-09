import { describe, expect, it } from 'vitest'
import { emphasisNotes } from './emphasisNotes'
import { buildField } from '../buildField'
import { DEFAULT_RAST_STATE, DEFAULT_RAST_STATE as RAST } from '../ajnas/MANDALS'

// Default: Rast from C3 (midi 48), 4 octaves = 28 courses, indices 0..27
// Degrees cycle: 1,2,3,4,5,6,7 per octave
// degree-1 courses: 0,7,14,21  (octaves 0,1,2,3)
// degree-5 courses: 4,11,18,25 (the ghammaz for rast lower jins, ghammazDegree=5)
// degree-7 courses: 6,13,20,27

describe('emphasisNotes — Rast C3 defaults', () => {
  const courses = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })

  it('tonic: courses with degree === 1', () => {
    const result = emphasisNotes({ mandalState: RAST, courses })
    expect(result.tonic).toEqual([0, 7, 14, 21])
  })

  it('ghammaz: courses with degree === ghammazDegree of lower jins (5 for Rast)', () => {
    const result = emphasisNotes({ mandalState: RAST, courses })
    expect(result.ghammaz).toEqual([4, 11, 18, 25])
  })

  it('octave: tonic courses at octave >= 1', () => {
    const result = emphasisNotes({ mandalState: RAST, courses })
    // octave 0 = index 0, octave 1 = index 7, octave 2 = index 14, octave 3 = index 21
    expect(result.octave).toEqual([7, 14, 21])
  })

  it('leadingTone: courses with degree === 7', () => {
    const result = emphasisNotes({ mandalState: RAST, courses })
    expect(result.leadingTone).toEqual([6, 13, 20, 27])
  })
})

describe('emphasisNotes — Bayati (ghammaz on degree 4)', () => {
  const BAYATI = [0, 1.5, 3, 5, 7, 8, 10] as const
  const courses = buildField({ tonicMidi: 48, mandalState: BAYATI })

  it('ghammaz: courses with degree === 4 (for bayati, ghammazDegree=4)', () => {
    const result = emphasisNotes({ mandalState: BAYATI, courses })
    // degree-4 indices within 28 courses: 3, 10, 17, 24
    expect(result.ghammaz).toEqual([3, 10, 17, 24])
  })
})

describe('emphasisNotes — custom/unknown state falls back to degree 5 ghammaz', () => {
  const CUSTOM = [0, 1.5, 4, 6, 7, 8.5, 11] as const
  const courses = buildField({ tonicMidi: 48, mandalState: CUSTOM })

  it('ghammaz falls back to degree 5 if identifyAjnas returns null lower', () => {
    const result = emphasisNotes({ mandalState: CUSTOM, courses })
    // degree-5 indices: 4, 11, 18, 25
    expect(result.ghammaz).toEqual([4, 11, 18, 25])
  })
})
