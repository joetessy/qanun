import { describe, expect, it } from 'vitest'
import { ownsKeyboard } from './ownsKeyboard'

const input = (type: string): HTMLInputElement => {
  const el = document.createElement('input')
  el.type = type
  return el
}

describe('ownsKeyboard', () => {
  it('lets text entry and selects keep their keystrokes', () => {
    expect(ownsKeyboard(input('text'))).toBe(true)
    expect(ownsKeyboard(input('number'))).toBe(true) // the BPM field
    expect(ownsKeyboard(document.createElement('textarea'))).toBe(true)
    expect(ownsKeyboard(document.createElement('select'))).toBe(true)
  })
  it('leaves the instrument keys to sliders, buttons and the page', () => {
    expect(ownsKeyboard(input('range'))).toBe(false)
    expect(ownsKeyboard(input('checkbox'))).toBe(false)
    expect(ownsKeyboard(document.createElement('button'))).toBe(false)
    expect(ownsKeyboard(document.body)).toBe(false)
    expect(ownsKeyboard(null)).toBe(false)
    expect(ownsKeyboard(window)).toBe(false)
  })
})
