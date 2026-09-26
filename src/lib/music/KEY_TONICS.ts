// One tonic per key, indexed by pitch class (C = 0 … B = 11): A3…A♭4, so every
// key keeps the field in the same register around C4 (the range the old
// dropdown offered) — A, B♭ and B sit just under C4, the rest above it.
export const KEY_TONICS: readonly number[] = Array.from({ length: 12 }, (_, pc) => (pc >= 9 ? 48 + pc : 60 + pc))

// Pitch classes whose flat-spelled name carries an accidental — a keyboard's
// black keys (D♭ E♭ G♭ A♭ B♭).
export const ACCIDENTAL_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10])
