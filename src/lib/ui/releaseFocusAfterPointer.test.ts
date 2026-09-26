import { afterEach, describe, expect, it } from 'vitest'
import { releaseFocusAfterPointer } from './releaseFocusAfterPointer'

const setup = () => {
  const root = document.createElement('div')
  const slider = document.createElement('input')
  slider.type = 'range'
  const select = document.createElement('select')
  select.append(new Option('a'), new Option('b'))
  const bpm = document.createElement('input')
  bpm.type = 'number'
  root.append(slider, select, bpm)
  document.body.append(root)
  const cleanup = releaseFocusAfterPointer(root)
  return { slider, select, bpm, cleanup }
}

interface FireArgs {
  target: EventTarget
  type: string
  key?: string
}

// jsdom has no PointerEvent constructor; the pointer listeners only key on the
// event type. Keys go out as real KeyboardEvents so preventDefault is visible.
const fire = ({ target, type, key }: FireArgs): Event => {
  const event = key === undefined
    ? new Event(type, { bubbles: true, cancelable: true })
    : new KeyboardEvent(type, { key, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

afterEach(() => { document.body.innerHTML = '' })

describe('releaseFocusAfterPointer', () => {
  it('blurs a slider when the pointer lets go of it', () => {
    const { slider } = setup()
    fire({ target: slider, type: 'pointerdown' })
    slider.focus()
    fire({ target: window, type: 'pointerup' })
    expect(document.activeElement).not.toBe(slider)
  })

  it('still lets go after a key is pressed mid-drag (a pluck, Shift)', () => {
    const { slider } = setup()
    fire({ target: slider, type: 'pointerdown' })
    slider.focus()
    fire({ target: slider, type: 'keydown', key: 'a' })
    fire({ target: slider, type: 'keydown', key: 'Shift' })
    fire({ target: slider, type: 'change' })
    expect(document.activeElement).not.toBe(slider)
  })

  it('blurs a select once a pointer pick commits (not on pointerup)', () => {
    const { select } = setup()
    fire({ target: select, type: 'pointerdown' })
    select.focus()
    fire({ target: window, type: 'pointerup' })
    expect(document.activeElement).toBe(select) // popup still open — keep it
    fire({ target: select, type: 'change' })
    expect(document.activeElement).not.toBe(select)
  })

  it('takes the next key from a select picked without a change, and lets go', () => {
    const { select } = setup()
    fire({ target: select, type: 'pointerdown' })
    select.focus()
    const arrow = fire({ target: select, type: 'keydown', key: 'ArrowDown' })
    expect(arrow.defaultPrevented).toBe(true) // no popup, no value change
    expect(document.activeElement).not.toBe(select)
  })

  it('leaves Tab alone on a pointer-focused select', () => {
    const { select } = setup()
    fire({ target: select, type: 'pointerdown' })
    select.focus()
    const tab = fire({ target: select, type: 'keydown', key: 'Tab' })
    expect(tab.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(select) // the browser moves focus itself
  })

  it('leaves a keyboard user focused on the slider they came back to', () => {
    const { slider } = setup()
    fire({ target: slider, type: 'pointerdown' }) // an earlier click…
    fire({ target: window, type: 'pointerup' })
    slider.focus()                                // …then Tab back to it
    fire({ target: slider, type: 'keydown', key: 'ArrowRight' })
    fire({ target: slider, type: 'change' })
    fire({ target: window, type: 'pointerup' })
    expect(document.activeElement).toBe(slider)
  })

  it('never blurs text entry', () => {
    const { bpm } = setup()
    fire({ target: bpm, type: 'pointerdown' })
    bpm.focus()
    fire({ target: bpm, type: 'keydown', key: '9' })
    fire({ target: bpm, type: 'change' })
    fire({ target: window, type: 'pointerup' })
    expect(document.activeElement).toBe(bpm)
  })

  it('stops listening after cleanup', () => {
    const { slider, cleanup } = setup()
    cleanup()
    fire({ target: slider, type: 'pointerdown' })
    slider.focus()
    fire({ target: window, type: 'pointerup' })
    expect(document.activeElement).toBe(slider)
  })
})
