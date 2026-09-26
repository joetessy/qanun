const isRange = (el: EventTarget | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === 'range'

// Keys a keyboard user operates a control with. Seeing one means focus arrived
// (or is being used) from the keyboard, so it's theirs to keep.
const NAVIGATION_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])

// Hand the keyboard back to the instrument after a control inside `root` is
// used with the POINTER: a slider you dragged or a select you picked from
// keeps focus otherwise, and then the next arrow nudges it (or a letter
// retunes a select by type-ahead) instead of playing. Keyboard use is left
// alone — someone who tabbed in keeps focus, and their slider's arrows.
// - A slider lets go on its committing `change` or on the pointer's release
//   anywhere (a click that doesn't move it fires no change). Keys pressed
//   mid-drag (plucking a note, holding Shift) don't count as keyboard use.
// - A select lets go on `change`. If it was picked without changing (no
//   `change`), the next key it gets is taken from it — no type-ahead, no
//   arrows — and it lets go so that key can play. (Blurring it on pointerup
//   instead would snap its popup shut.)
// Returns the cleanup.
export const releaseFocusAfterPointer = (root: HTMLElement): (() => void) => {
  let pointerTarget: EventTarget | null = null
  let draggingSlider = false
  const release = (el: EventTarget | null): void => {
    if (el instanceof HTMLElement && el === pointerTarget && document.activeElement === el) el.blur()
  }
  const onPointerDown = (e: Event): void => {
    pointerTarget = e.target
    draggingSlider = isRange(e.target)
  }
  const onPointerUp = (): void => {
    draggingSlider = false
    if (isRange(pointerTarget)) release(pointerTarget)
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (draggingSlider) return
    if (e.key === 'Tab') {
      pointerTarget = null
      return
    }
    const picked = pointerTarget
    if (picked instanceof HTMLSelectElement && e.target === picked && document.activeElement === picked) {
      e.preventDefault()
      picked.blur()
      return
    }
    if (NAVIGATION_KEYS.has(e.key)) pointerTarget = null
  }
  const onChange = (e: Event): void => {
    if (isRange(e.target) || e.target instanceof HTMLSelectElement) release(e.target)
  }
  root.addEventListener('pointerdown', onPointerDown, true)
  root.addEventListener('keydown', onKeyDown, true)
  root.addEventListener('change', onChange)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  return () => {
    root.removeEventListener('pointerdown', onPointerDown, true)
    root.removeEventListener('keydown', onKeyDown, true)
    root.removeEventListener('change', onChange)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }
}
