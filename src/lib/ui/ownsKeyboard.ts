// Input types whose keystrokes are text: typing a BPM must not pick a jins.
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password'])

// True when a focused element needs the raw keystrokes itself, so the
// instrument's keyboard shortcuts must stand aside: text entry, and a <select>
// (its arrows and type-ahead ARE its value — a stray "d" would retune it).
// Everything else — sliders, buttons, chips — leaves the letter and digit keys
// to the instrument; arrows still reach a slider natively for keyboard users.
export const ownsKeyboard = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)
}
