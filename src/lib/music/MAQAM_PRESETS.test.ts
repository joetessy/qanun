import { describe, expect, it } from 'vitest'
import { MAQAM_PRESETS, presetById } from './MAQAM_PRESETS'
import { identifyAjnas } from './identifyAjnas'
import { DEFAULT_RAST_STATE } from './ajnas/MANDALS'

describe('MAQAM_PRESETS — structure', () => {
  it('exports 8 presets', () => {
    expect(MAQAM_PRESETS).toHaveLength(8)
  })

  it('has rast as first entry with id "rast"', () => {
    expect(MAQAM_PRESETS[0].id).toBe('rast')
  })

  it('rast.mandalState deep-equals DEFAULT_RAST_STATE', () => {
    expect(MAQAM_PRESETS[0].mandalState).toEqual(DEFAULT_RAST_STATE)
  })

  it('presetById("rast") returns the rast preset', () => {
    const p = presetById('rast')
    expect(p).toBeDefined()
    expect(p!.id).toBe('rast')
  })

  it('presetById("nonexistent") returns undefined', () => {
    expect(presetById('nonexistent')).toBeUndefined()
  })

  it('every preset has id, name, and a 7-element mandalState', () => {
    for (const p of MAQAM_PRESETS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.mandalState).toHaveLength(7)
    }
  })
})

describe('MAQAM_PRESETS — round-trip invariant', () => {
  it('every preset round-trips through identifyAjnas', () => {
    for (const p of MAQAM_PRESETS) {
      const id = identifyAjnas(p.mandalState)
      expect(id.maqamName).toBe(p.name)
    }
  })

  it('Maqam Rast round-trips', () => {
    const rast = presetById('rast')!
    expect(identifyAjnas(rast.mandalState).maqamName).toBe('Maqam Rast')
  })

  it('Maqam Bayati round-trips', () => {
    const bayati = presetById('bayati')!
    expect(identifyAjnas(bayati.mandalState).maqamName).toBe('Maqam Bayati')
  })

  it('Maqam Hijaz round-trips', () => {
    const hijaz = presetById('hijaz')!
    expect(identifyAjnas(hijaz.mandalState).maqamName).toBe('Maqam Hijaz')
  })

  it('Maqam Nahawand round-trips', () => {
    const nahawand = presetById('nahawand')!
    expect(identifyAjnas(nahawand.mandalState).maqamName).toBe('Maqam Nahawand')
  })

  it('Maqam Nikriz round-trips', () => {
    const nikriz = presetById('nikriz')!
    expect(identifyAjnas(nikriz.mandalState).maqamName).toBe('Maqam Nikriz')
  })

  it('Maqam Saba round-trips', () => {
    const saba = presetById('saba')!
    expect(identifyAjnas(saba.mandalState).maqamName).toBe('Maqam Saba')
  })

  it('Maqam Suznak round-trips', () => {
    const suznak = presetById('suznak')!
    expect(identifyAjnas(suznak.mandalState).maqamName).toBe('Maqam Suznak')
  })

  it('Maqam Kurd round-trips', () => {
    const kurd = presetById('kurd')!
    expect(identifyAjnas(kurd.mandalState).maqamName).toBe('Maqam Kurd')
  })
})
