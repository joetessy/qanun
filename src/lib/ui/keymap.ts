// Single source of truth for the keyboard binding tables. The engine's keydown
// handler consumes these directly; the UI components import them and uppercase
// for display, so a key label can never silently drift from the real handler.
// (Typed as readonly string[] — not `as const` tuples — so `indexOf(key)` accepts
// an arbitrary KeyboardEvent key.)

// Jins mode: pick the lower jins family (in lowerJinsList order).
export const LOWER_JINS_KEYS: readonly string[] = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o']
// Jins mode: pick the upper jins on the ghammāz (in upperOptions order).
export const UPPER_JINS_KEYS: readonly string[] = ['1', '2', '3', '4', '5']
// Qanun mode: two adjacent rows, one quarter-tone step per press, degree d =
// index + 1. Raise on the Q row, lower on the number row directly above it.
export const QANUN_RAISE_KEYS: readonly string[] = ['q', 'w', 'e', 'r', 't', 'y', 'u'] // C..B up
export const QANUN_LOWER_KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7'] // C..B down
// Computer-keyboard play layer (both modes): the home row plays the scale up
// from the tonic; Z / X drop / raise the octave (handled separately).
export const PLAY_KEYS: readonly string[] = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"]
