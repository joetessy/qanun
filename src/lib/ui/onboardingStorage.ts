// Persists whether the user has seen the onboarding overlay.
// Guards against localStorage being unavailable (private-browsing, security
// restrictions, storage quota exceeded).

const KEY = 'qanun.onboarded'

/** Returns true only when the onboarding has been explicitly confirmed. */
export const hasOnboarded = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Records that the user has seen and dismissed the onboarding overlay. */
export const setOnboarded = (): void => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Quota exceeded or storage unavailable — silently ignore.
  }
}
