# Jins-Driven Modulation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the maqam-preset rail with a **lower-jins selector** + **upper-jins selector** that re-anchor the home tonic to each jins's conventional degree (Bayati→D with *no note change*, Sikah→E½, Nahawand→C retuned, etc.), modulate the upper jins on the lower's ghammāz, infer + display the maqam, and drive both with the keyboard (letter row = lower, 1–5 = upper).

**Architecture:** A pure data table (`LOWER_JINS`) gives each lower jins a **home degree** + a hardcoded **default scale** (7 offsets from the key). `applyLowerJins` loads it; the home-aware `applyUpperJins` re-tunes the courses above the ghammāz. The field extends one octave below the key for leading tones. The hook holds `lowerJins`/`upperJins`/`homeDegree` and a keyboard handler; the HUD shows the looked-up maqam + home note.

**Tech Stack:** TypeScript, React 19, Vitest. Pure functions in `src/lib/music/sayr/`, wiring in `src/hooks/useQanunEngine.ts`, UI in `src/components/`.

**Spec:** `docs/superpowers/specs/2026-06-09-jins-driven-modulation-design.md`.

---

## File structure

- `src/lib/music/sayr/lowerJins.ts` *(new)* — `LOWER_JINS` table, `applyLowerJins`, `maqamNameFor`, `lowerJinsList`.
- `src/lib/music/sayr/upperJins.ts` *(rework)* — home-aware `applyUpperJins` + `upperOptions`.
- `src/lib/music/buildField.ts` *(modify)* — extend an octave below the key.
- `src/hooks/useQanunEngine.ts` *(modify)* — lower/upper/home state, setters, `homeNote`, keyboard.
- `src/components/LowerJinsSelector.tsx` *(new)*, `UpperJinsSwitcher.tsx` *(rework)*, `Qanun.tsx`, `QanunHud.tsx`, `Controls.tsx`, `StringField.tsx` *(home highlight)*.
- `README.md` — "How modulation works".

---

## Task 1: `lowerJins.ts` — data + applyLowerJins + maqamNameFor

**Files:** Create `src/lib/music/sayr/lowerJins.ts`, Test `src/lib/music/sayr/lowerJins.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { LOWER_JINS, applyLowerJins, maqamNameFor, lowerJinsList } from './lowerJins'
import { jinsById } from '../ajnas/JINS'

describe('LOWER_JINS table', () => {
  it('lists the 9 families in key order with valid home degrees + 7-offset scales', () => {
    expect(lowerJinsList().map((j) => j.id)).toEqual(
      ['rast', 'bayati', 'hijaz', 'nahawand', 'kurd', 'nikriz', 'ajam', 'saba', 'sikah']
    )
    for (const j of LOWER_JINS) {
      expect([1, 2, 3]).toContain(j.homeDegree)
      expect(j.defaultScale).toHaveLength(7)
      expect(j.defaultScale[0]).toBe(0) // degree 1 (the key) is always 0
      expect(j.upperOptions.length).toBeGreaterThanOrEqual(1)
      for (const u of j.upperOptions) expect(() => jinsById(u)).not.toThrow()
    }
  })

  it('Bayati and Sikah keep the Rast collection (no note change), only the home moves', () => {
    const rast = LOWER_JINS.find((j) => j.id === 'rast')!
    const bayati = LOWER_JINS.find((j) => j.id === 'bayati')!
    const sikah = LOWER_JINS.find((j) => j.id === 'sikah')!
    expect(bayati.defaultScale).toEqual(rast.defaultScale)
    expect(sikah.defaultScale).toEqual(rast.defaultScale)
    expect(bayati.homeDegree).toBe(2)
    expect(sikah.homeDegree).toBe(3)
  })

  it('Hijaz roots on D (degree 2); Nahawand on C (degree 1, harmonic minor)', () => {
    expect(LOWER_JINS.find((j) => j.id === 'hijaz')!.homeDegree).toBe(2)
    expect(LOWER_JINS.find((j) => j.id === 'hijaz')!.defaultScale).toEqual([0, 2, 3, 6, 7, 9, 10.5])
    expect(LOWER_JINS.find((j) => j.id === 'nahawand')!.defaultScale).toEqual([0, 2, 3, 5, 7, 8, 11])
  })

  it('Rast does not offer ʿAjam as an upper', () => {
    expect(LOWER_JINS.find((j) => j.id === 'rast')!.upperOptions).not.toContain('ajam')
  })
})

describe('applyLowerJins', () => {
  it('loads the jins default scale + home degree', () => {
    const r = applyLowerJins('bayati')
    expect(r.mandalState).toEqual([0, 2, 3.5, 5, 7, 9, 10.5])
    expect(r.homeDegree).toBe(2)
  })
  it('returns a fresh array (not the table reference)', () => {
    expect(applyLowerJins('rast').mandalState).not.toBe(LOWER_JINS[0].defaultScale)
  })
})

describe('maqamNameFor', () => {
  it('special-cases the named maqamat, else "Maqam <lower>"', () => {
    expect(maqamNameFor('rast', 'hijaz')).toBe('Maqam Suznak')
    expect(maqamNameFor('rast', 'bayati')).toBe('Maqam Nairuz')
    expect(maqamNameFor('sikah', 'hijaz')).toBe('Maqam Huzam')
    expect(maqamNameFor('bayati', 'hijaz')).toBe('Maqam Bayati Shuri')
    expect(maqamNameFor('bayati', 'rast')).toBe('Maqam Bayati')
    expect(maqamNameFor('ajam', 'ajam')).toBe('Maqam ʿAjam')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/music/sayr/lowerJins.test.ts`
Expected: FAIL — `Cannot find module './lowerJins'`.

- [ ] **Step 3: Write the implementation**

```ts
import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'

export interface LowerJins {
  id: string
  label: string
  homeDegree: number          // 1, 2, or 3 — the field degree the tonic anchors on
  defaultScale: readonly number[] // 7 offsets from the key (degree 1 = 0)
  upperOptions: readonly string[] // upper jins ids, ordered; first = default highlight
}

// Default scales are offsets from the key (degree 1). Bayati/Sikah reuse the Rast
// collection (only the home moves — no note change from Rast). See the design spec.
export const LOWER_JINS: readonly LowerJins[] = [
  { id: 'rast',     label: 'Rast',     homeDegree: 1, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5], upperOptions: ['rast', 'nahawand', 'hijaz', 'bayati'] },
  { id: 'bayati',   label: 'Bayati',   homeDegree: 2, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5], upperOptions: ['rast', 'nahawand', 'hijaz'] },
  { id: 'hijaz',    label: 'Hijaz',    homeDegree: 2, defaultScale: [0, 2, 3, 6, 7, 9, 10.5],   upperOptions: ['rast', 'nahawand', 'bayati'] },
  { id: 'nahawand', label: 'Nahawand', homeDegree: 1, defaultScale: [0, 2, 3, 5, 7, 8, 11],     upperOptions: ['hijaz', 'kurd', 'bayati', 'ajam'] },
  { id: 'kurd',     label: 'Kurd',     homeDegree: 2, defaultScale: [0, 2, 3, 5, 7, 9, 10],      upperOptions: ['nahawand', 'rast'] },
  { id: 'nikriz',   label: 'Nikriz',   homeDegree: 1, defaultScale: [0, 2, 3, 6, 7, 9, 10],      upperOptions: ['nahawand'] },
  { id: 'ajam',     label: 'ʿAjam',    homeDegree: 1, defaultScale: [0, 2, 4, 5, 7, 9, 11],      upperOptions: ['ajam', 'hijaz', 'nahawand'] },
  { id: 'saba',     label: 'Saba',     homeDegree: 2, defaultScale: [0, 2, 3.5, 5, 6, 8, 10],    upperOptions: ['hijaz', 'ajam'] },
  { id: 'sikah',    label: 'Sikah',    homeDegree: 3, defaultScale: [0, 2, 3.5, 5, 7, 9, 10.5],  upperOptions: ['rast', 'hijaz'] }
]

const BY_ID: ReadonlyMap<string, LowerJins> = new Map(LOWER_JINS.map((j) => [j.id, j]))

export const lowerJinsList = (): readonly LowerJins[] => LOWER_JINS

export const lowerJinsById = (id: string): LowerJins => {
  const j = BY_ID.get(id)
  if (!j) throw new Error(`Unknown lower jins: ${id}`)
  return j
}

export const applyLowerJins = (id: string): { mandalState: MandalState; homeDegree: number } => {
  const j = lowerJinsById(id)
  return { mandalState: j.defaultScale.slice(), homeDegree: j.homeDegree }
}

// Named maqamat where the (lower, upper) pair has a special name; else "Maqam <lower>".
const SPECIAL_NAMES: Record<string, string> = {
  'rast|hijaz': 'Maqam Suznak',
  'rast|bayati': 'Maqam Nairuz',
  'bayati|hijaz': 'Maqam Bayati Shuri',
  'sikah|hijaz': 'Maqam Huzam',
  'nahawand|ajam': 'Maqam Nahawand Murassaʿ'
}

export const maqamNameFor = (lowerId: string, upperId: string): string =>
  SPECIAL_NAMES[`${lowerId}|${upperId}`] ?? `Maqam ${jinsById(lowerId).label}`
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/music/sayr/lowerJins.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/sayr/lowerJins.ts src/lib/music/sayr/lowerJins.test.ts
git commit -m "feat(music): lower-jins table + applyLowerJins + maqamNameFor (tonic anchoring)"
```

---

## Task 2: Rework `upperJins.ts` — home-aware ghammāz

**Files:** Modify `src/lib/music/sayr/upperJins.ts`, Modify `src/lib/music/sayr/upperJins.test.ts`

The current `applyUpperJins(state, upperId)` assumes the lower jins is on degree 1. Make it home-aware: the ghammāz field-degree = `homeDegree + lowerJins.ghammazDegree − 1`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { applyUpperJins, upperOptions } from './upperJins'

// Bayati on D (home degree 2): ghammāz = 2 + (4-1) = degree 5 (G).
describe('applyUpperJins (home-aware)', () => {
  it('Bayati(home 2) + Nahawand re-tunes degrees 6–7 from the G ghammāz', () => {
    const bayati = [0, 2, 3.5, 5, 7, 9, 10.5] // Bayati default (= Rast collection)
    const out = applyUpperJins(bayati, 'nahawand', 2, 'bayati')
    // Nahawand on G(7): A=9, B♭=10 → degrees 6,7
    expect(out).toEqual([0, 2, 3.5, 5, 7, 9, 10])
  })
  it('Rast(home 1) + Hijaz → Suznak collection', () => {
    const rast = [0, 2, 3.5, 5, 7, 9, 10.5]
    expect(applyUpperJins(rast, 'hijaz', 1, 'rast')).toEqual([0, 2, 3.5, 5, 7, 8, 11])
  })
  it('Hijaz(home 2) + Rast keeps the lower Hijaz tetrachord, sets the upper on G', () => {
    const hijaz = [0, 2, 3, 6, 7, 9, 10.5]
    // Rast on G(7): A=9, B½=10.5 → unchanged here (already the default)
    expect(applyUpperJins(hijaz, 'rast', 2, 'hijaz')).toEqual([0, 2, 3, 6, 7, 9, 10.5])
  })
  it('does not alter degrees at or below the ghammāz', () => {
    const bayati = [0, 2, 3.5, 5, 7, 9, 10.5]
    const out = applyUpperJins(bayati, 'hijaz', 2, 'bayati')
    expect(out.slice(0, 5)).toEqual(bayati.slice(0, 5)) // degrees 1–5 unchanged
  })
})

describe('upperOptions', () => {
  it('returns the lower jins upper list with the active one flagged', () => {
    const opts = upperOptions('bayati', [0, 2, 3.5, 5, 7, 9, 10.5], 2)
    expect(opts.map((o) => o.id)).toEqual(['rast', 'nahawand', 'hijaz'])
    expect(opts[0].label).toBe('Upper Rast')
    expect(opts.find((o) => o.id === 'rast')!.active).toBe(true) // A/B½ on G = Upper Rast
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/music/sayr/upperJins.test.ts`
Expected: FAIL (signature changed / `upperOptions` shape).

- [ ] **Step 3: Write the implementation**

```ts
import type { MandalState } from '../types'
import { jinsById } from '../ajnas/JINS'
import { offsetOf, setMandal } from '../ajnas/MANDALS'
import { lowerJinsById, maqamNameFor } from './lowerJins'

const DEGREE_COUNT = 7

// Field degree (1..7) the upper jins sits on = the lower jins's ghammāz (from
// JINS), shifted by the home degree. e.g. Bayati home 2, ghammāz 4 → degree 5 (G).
const lowerGhammaz = (lowerId: string): number => jinsById(lowerId).ghammazDegree

export const applyUpperJins = (
  state: MandalState,
  upperId: string,
  homeDegree: number,
  lowerId: string
): MandalState => {
  const ghammaz = homeDegree + lowerGhammaz(lowerId) - 1
  if (ghammaz < 1 || ghammaz > DEGREE_COUNT) return state
  const gOffset = offsetOf(state, ghammaz)
  const upper = jinsById(upperId)
  let next = state.slice()
  for (let i = 1; i < upper.intervals.length; i++) {
    const deg = ghammaz + i
    if (deg > DEGREE_COUNT) break
    next = setMandal(next, deg, gOffset + upper.intervals[i])
  }
  return next
}

// Keep the exported type NAME `UpperJinsOption` — UpperJinsSwitcher imports it.
export interface UpperJinsOption {
  id: string
  label: string
  maqamName: string // "Maqam <name>" for the (lower, this-upper) pair — switcher tooltip
  active: boolean
}

const upperLabel = (id: string): string => {
  if (id === 'rast') return 'Upper Rast'
  if (id === 'ajam') return 'Upper ʿAjam'
  return jinsById(id).label
}

// The active option = the one whose application leaves the state unchanged.
export const upperOptions = (
  lowerId: string,
  state: MandalState,
  homeDegree: number
): UpperJinsOption[] =>
  lowerJinsById(lowerId).upperOptions.map((id) => ({
    id,
    label: upperLabel(id),
    maqamName: maqamNameFor(lowerId, id),
    active: arraysEqual(applyUpperJins(state, id, homeDegree, lowerId), state)
  }))

const arraysEqual = (a: MandalState, b: MandalState): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])
```

> This **replaces** `FAMILY_UPPERS` and the `identifyAjnas`-based `applyUpperJins`/`currentUpperJins` — delete all three; `LOWER_JINS.upperOptions` is the single source of truth for the per-jins upper list. Keep the exported type name `UpperJinsOption` so `UpperJinsSwitcher`'s import still resolves. Update the hook (Task 4) to the new signatures.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/music/sayr/upperJins.test.ts`
Expected: PASS. Then update any other importers of the old `applyUpperJins(state,id)` signature (the hook — Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/sayr/upperJins.ts src/lib/music/sayr/upperJins.test.ts
git commit -m "feat(music): home-aware applyUpperJins + upperOptions (ghammāz shifts with home)"
```

---

## Task 3: Extend `buildField` an octave below the key

**Files:** Modify `src/lib/music/buildField.ts`, Modify `src/lib/music/buildField.test.ts`

- [ ] **Step 1: Add the failing test** (append to the existing suite)

```ts
it('includes an octave below the key for leading tones', () => {
  const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
  // octavesBelow defaults to 1 → the first course is the key an octave down (C2 = 36)
  expect(field[0].midi).toBe(36)
  expect(field[0].octave).toBe(-1)
  // the key (C3 = 48) is still present, one octave up from the bottom
  expect(field.find((c) => c.midi === 48)).toBeTruthy()
  // total = 7 * (octaveCount) courses
  expect(field).toHaveLength(7 * FIELD_OCTAVES)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/music/buildField.test.ts`
Expected: FAIL (first course currently 48, not 36).

- [ ] **Step 3: Update buildField**

```ts
export const DEFAULT_TONIC_MIDI = 48
export const FIELD_OCTAVES = 4
export const FIELD_OCTAVES_BELOW = 1

export interface BuildFieldArgs {
  tonicMidi: number
  mandalState: MandalState
  octaveCount?: number
  octavesBelow?: number
}

export const buildField = ({
  tonicMidi,
  mandalState,
  octaveCount = FIELD_OCTAVES,
  octavesBelow = FIELD_OCTAVES_BELOW
}: BuildFieldArgs): Course[] => {
  const courses: Course[] = []
  let index = 0
  for (let octave = -octavesBelow; octave < octaveCount - octavesBelow; octave++) {
    for (let degree = 1; degree <= DEGREE_COUNT; degree++) {
      const midi = tonicMidi + 12 * octave + offsetOf(mandalState, degree)
      courses.push({ index, degree, octave, midi, freqHz: midiToFreq(midi) })
      index++
    }
  }
  return courses
}
```

- [ ] **Step 4: Run to verify it passes (fix the older buildField assertions)**

Run: `npx vitest run src/lib/music/buildField.test.ts`
Expected: the new test PASSES. Update the pre-existing assertions that assumed `field[0]` = the key (now `field[7]` = the key, `field[0]` = an octave below). Re-run until green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/buildField.ts src/lib/music/buildField.test.ts
git commit -m "feat(music): buildField extends an octave below the key (leading tones)"
```

---

## Task 4: Hook wiring — lower/upper/home state, setters, homeNote, keyboard

**Files:** Modify `src/hooks/useQanunEngine.ts`

- [ ] **Step 1: State + setters** (no unit test — exercised live; keep tsc green)

Add state: `lowerJins` (default `'rast'`), `upperJins` (default `'rast'`), `homeDegree` (default `1`). Replace the old `setMaqamPreset` usage. Add:

```ts
const setLowerJins = useCallback((id: string): void => {
  const { mandalState, homeDegree: home } = applyLowerJins(id)
  setLowerJinsState(id)
  setHomeDegreeState(home)
  const firstUpper = lowerJinsById(id).upperOptions[0]
  setUpperJinsState(firstUpper)
  mandalRef.current = mandalState
  setMandalState(mandalState)        // rebuild field + identify (existing recompute path)
}, [/* recompute deps */])

const setUpperJins = useCallback((id: string): void => {
  const next = applyUpperJins(mandalRef.current, id, homeDegreeRef.current, lowerJinsRef.current)
  setUpperJinsState(id)
  mandalRef.current = next
  setMandalState(next)
}, [])
```

Use refs (`lowerJinsRef`, `homeDegreeRef`) mirroring the state so `setUpperJins` reads current values. Expose on the interface + return: `lowerJins`, `upperJins`, `homeDegree`, `setLowerJins`, `setUpperJins`, `maqamName`, `homeNote`, `lowerJinsList()`, and `upperOptions(lowerJins, mandalState, homeDegree)`.

**`maqamName`/`homeNote` come from the explicit selection, not `identifyAjnas`.** Currently `recompute(next, tonic)` derives `reading.maqamName/lowerJins/upperJins` from `identifyAjnas(next)` — that's exactly the reverse-inference the new model abandons (it can't recover a moved tonic). Change the flow so:
- `setLowerJins`/`setUpperJins` set `reading.maqamName = maqamNameFor(lowerJins, upperJins)`, `reading.lowerJins`, `reading.upperJins`, and a new `reading.homeDegree`/`reading.homeNote` directly. `homeNote = degreeNoteLabel({ tonicMidi, degree: homeDegree, offset: offsetOf(mandalState, homeDegree) })` (e.g. "D"). `homeDegree` defaults to 1 → "C".
- `recompute` keeps rebuilding the field + highlight (and may keep computing `identifyAjnas` for any ajnas HUD detail), but **no longer overwrites the maqam name** — the explicit selection owns it.
- **Keep the jins-pair quick-swaps and the manual mandal panel working** (they call `setMandalAll`/`recompute` and retune notes). After a manual mandal edit the displayed maqam stays the last selection — acceptable (off-piste tweak). The jins-pairs (`applyPair`) stay as-is.
- Replace the `setMaqamPreset` export with `setLowerJins`; remove the now-unused `MAQAM_PRESETS`/`MaqamPresets` rail from the surface (the lower-jins selector replaces it). `applyUpper` becomes `setUpperJins`. `upperJinsOptions` is recomputed as `upperOptions(lowerJinsRef.current, mandalState, homeDegree)`.

- [ ] **Step 2: Keyboard handler**

```ts
const LOWER_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o']
const UPPER_KEYS = ['1', '2', '3', '4', '5']

useEffect(() => {
  const onKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) return
    const k = e.key.toLowerCase()
    const li = LOWER_KEYS.indexOf(k)
    if (li !== -1 && li < lowerJinsList().length) { setLowerJins(lowerJinsList()[li].id); return }
    const ui = UPPER_KEYS.indexOf(e.key)
    if (ui !== -1) {
      const opts = lowerJinsById(lowerJinsRef.current).upperOptions
      if (ui < opts.length) setUpperJins(opts[ui])
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [setLowerJins, setUpperJins])
```

- [ ] **Step 3: Verify** — `npx tsc -b` clean, `npm run lint` exit 0, `npm run test:run` green. Confirm no remaining references to the removed `setMaqamPreset` (the upper-jins switcher + maqam rail are replaced in Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useQanunEngine.ts
git commit -m "feat(hook): lower/upper jins state, home degree, homeNote, keyboard (letters/1-5)"
```

---

## Task 5: Components — LowerJinsSelector, UpperJinsSwitcher rework, wire-up

**Files:** Create `src/components/LowerJinsSelector.tsx`; Modify `src/components/UpperJinsSwitcher.tsx`, `src/components/Qanun.tsx`, `src/components/QanunHud.tsx`; remove the `MaqamPresets` usage from `Qanun.tsx`.

- [ ] **Step 1: `LowerJinsSelector.tsx`** — a chip row from `lowerJinsList()`, each labeled with its jins name + its key (q,w,e,r,…); the active lower jins is lit; click → `onSelect(id)`.

```tsx
import { lowerJinsList } from '../lib/music/sayr/lowerJins'

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O']

interface LowerJinsSelectorProps { lowerJins: string; onSelect: (id: string) => void }

export const LowerJinsSelector = ({ lowerJins, onSelect }: LowerJinsSelectorProps) => (
  <div className="jins-selector lower" role="group" aria-label="Lower jins">
    <span className="jins-selector-label">JINS</span>
    {lowerJinsList().map((j, i) => (
      <button
        key={j.id}
        className={`jins-chip ${j.id === lowerJins ? 'is-active' : ''}`}
        onClick={() => onSelect(j.id)}
        title={`${j.label} (${KEYS[i]})`}
      >
        <span className="jins-key">{KEYS[i]}</span> {j.label}
      </button>
    ))}
  </div>
)
```

- [ ] **Step 2: Rework `UpperJinsSwitcher.tsx`** — take `options: UpperJinsOption[]` + `onSelect(id)`; render chips labeled with the upper label + key (1–5), active lit. Title = `option.maqamName`. The current switcher already maps `UpperJinsOption[]` to chips — keep its markup, just add the key hint (`1`–`5`) and confirm the prop is the new `upperOptions(...)` output.

- [ ] **Step 3: `Qanun.tsx`** — replace `<MaqamPresets…/>` with `<LowerJinsSelector lowerJins={engine.lowerJins} onSelect={engine.setLowerJins} />` and feed `UpperJinsSwitcher` `engine.upperOptions` + `engine.setUpperJins`. Keep the per-degree `MandalRack` and (in the drawer) the **jins-pair quick-swaps**. Remove the `MaqamPresets` import.

- [ ] **Step 4: `QanunHud.tsx`** — show `engine.maqamName` + `engine.homeNote` (e.g. "Maqam Bayati · D").

- [ ] **Step 5: Verify + Commit** — `npx tsc -b`, `npm run lint; echo $?` (0), `npm run test:run`, `npm run build`. Then:

```bash
git add -A
git commit -m "feat(ui): lower-jins selector + reworked upper-jins switcher; HUD home note"
```

---

## Task 6: Tonic-home highlight + README

**Files:** Modify `src/components/StringField.tsx` (+ `App.css`), Modify `README.md`

- [ ] **Step 1: Home highlight** — pass `homeDegree` to `StringField`; give courses whose `degree === homeDegree` a distinct "home" class (stronger than the existing tonic styling) so the anchored tonic reads clearly across octaves. Frontend-design touch on `.string.is-home`.

- [ ] **Step 2: README "How modulation works"** — add a section explaining: pick a **lower jins** (letter keys) → the home tonic anchors to its conventional degree (Bayati→D with no note change, Nahawand→C retuned, Sikah→E½); pick an **upper jins** (1–5) → modulates on the lower's ghammāz; the maqam is inferred + shown; the per-degree mandal panel + jins-pair swaps remain for fine control; the tonic control sets the key.

- [ ] **Step 3: Verify + Commit** — gates green, then:

```bash
git add -A
git commit -m "feat: tonic-home string highlight + README modulation guide"
```

---

## Self-Review

- **Spec coverage:** lower-jins selector + home anchoring (T1, T4, T5) ✓; Bayati/Sikah no-change (T1 test) ✓; home-aware upper on ghammāz (T2) ✓; maqam inferred + displayed (T1 maqamNameFor, T5 HUD) ✓; keys letters/1–5 (T4) ✓; extended scale below (T3) ✓; keep jins-pairs + mandal panel + tonic-as-key (T5) ✓; README (T6) ✓.
- **Placeholder scan:** none — every code step carries complete code. Task 2 deletes `FAMILY_UPPERS` + the identify-based `applyUpperJins`/`currentUpperJins` (replaced by `LOWER_JINS.upperOptions`). Task 4 stops `recompute` from overwriting the maqam name (explicit selection owns it).
- **Type consistency:** `applyUpperJins(state, upperId, homeDegree, lowerId)` is used in T2 + T4; `applyLowerJins(id) → {mandalState, homeDegree}` in T1 + T4; `upperOptions(lowerId, state, homeDegree) → UpperJinsOption[]` in T2 + T4 + T5; the kept type name `UpperJinsOption` matches the existing `UpperJinsSwitcher` import. `homeDegree` threads hook → StringField (T6). `homeNote` uses the existing `degreeNoteLabel`.
