# Qanun Phase 1 — Core Instrument Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use the **frontend-design** skill for every component task (Tasks 17–21).

**Goal:** A zero-config, browser-based, hand-tracked qanun you can play immediately in Rast on C — pluck and rake a scale-locked string field with both hands, retune via a 7-lever mandal rack, see what jins/maqam you're in, and quick-swap Bayati↔Saba / Hijaz↔Hijazkar — with a synth (Karplus-Strong) voice and a photoreal shell.

**Architecture:** Build a brand-new Vite + React 19 + TS-strict app on the `../theremin` foundation. Copy theremin's vision / One-Euro / draw / FX-reverb / music-util modules verbatim (they ship with their own passing tests). The **music model and gesture math are a pure-function TDD core** (`lib/music/*`, `lib/gesture/*`) — no DOM, no audio, no React — and carry the heaviest test weight: every jins reachable, `identifyAjnas` round-trips every core maqam. A thin `useQanunEngine` frame loop wires detect → hand-role → gesture → `createQanunEngine.pluck()` + state. Components render the field/rack/HUD over a mirrored camera, polished with the frontend-design skill.

**Tech Stack:** React 19, TypeScript (strict, bundler resolution), Vite 8, Vitest 3 (jsdom), Tone.js 15 (`PluckSynth` pool + `Reverb`), `@mediapipe/tasks-vision` (GPU hand landmarker), One-Euro smoothing.

---

## Scope notes (Phase 1)

Per the guiding principle (*simplest UX, possibilities intact*) and the session's scope clarification:

- **Tested jins core = the 9 family-head ajnas + Hijazkar:** Rast, Nahawand, ʿAjam, Bayati, Hijaz, Kurd, Nikriz, Sikah, Saba, Hijazkar. These all fit the spec's **literal** mandal table — no position-set refinement is required in P1.
- **Deferred (NOT in P1):** the variant ajnas Sazkar, Nahawand Murassaʿ, Mukhalif Sharqi, Lami, Saba Zamzam, Athar Kurd, Jiharkah, etc. Adding them later is a localized follow-up: add the rows to `JINS.ts`, add two mandal positions (degree 2 gains offset `3`; degree 5 gains offset `6`), and extend the reachability fixture. The architecture already supports it.
- **Jins-pair quick-swaps in P1:** Bayati↔Saba and Hijaz↔Hijazkar (both realizable with the literal table). Rast↔Sazkar / Nahawand↔Nahawand Murassaʿ / Sikah↔Mukhalif are deferred with the variant ajnas above. Nahawand↔Nikriz is **deliberately excluded** as a fluid pair (documented).
- **identifyAjnas in P1** names the degree-1-rooted families (Rast, Suznak, Nahawand, Bayati, Hijaz, Kurd, Nikriz) plus Saba (ghammāz on 3). Maqamat whose tonic is a half-flat 3rd (the Sikah family) are a known P1 identify limitation — the Sikah *jins* is still reachable and playable.
- **Sound in P1 = synth only** (`Tone.PluckSynth` pool). The sampled qanun (`Tone.Sampler`) and trichord layer are **P2**. The engine interface is sound-source-agnostic so P2 drops in behind it.
- **Deferred to later phases (not here):** sayr networks / sayr guide / emphasis overlay (P3); recording, drone, metronome, MIDI (P4); onboarding, light/dark, perf pass (P5).

---

## File structure

```
qanun/
  package.json                         T1  (new; P1 deps only — no electron/midi)
  index.html  vite.config.ts  vitest.config.ts                                T1
  tsconfig.json  tsconfig.app.json  tsconfig.node.json  eslint.config.js      T1
  src/
    main.tsx  App.tsx  index.css  App.css  test-setup.ts                       T1
    types.ts                           T15 (NormPoint, QanunStatus, RakeSensitivity, QanunReading)
    lib/
      vision/      constants, loadHandLandmarker, findHandedness,
                   pinchDistance, startCamera, stopCamera, scheduleVideoFrame  T2 (copied)
      oneEuro/     alpha, createLowPass, createOneEuroFilter, types            T2 (copied)
      draw/        projectPoint, drawFingerRing, drawHand, HAND_CONNECTIONS    T2 (copied)
      audio/
        reverbSize.ts (+ test)                                                 T2 (copied)
        velocityCurve.ts (+ test)                                              T13
        voicePool.ts (+ test)                                                  T13
        createQanunEngine.ts (+ test)                                          T14
      music/
        midiToFreq.ts  freqToMidi.ts  NOTE_NAMES.ts  midiName.ts  clamp01.ts   T2 (copied)
        types.ts                                                               T3
        ajnas/JINS.ts (+ test)                                                 T3
        ajnas/MANDALS.ts (+ test)                                              T4
        ajnas/reachability.ts (+ test)                                         T5
        buildField.ts (+ test)                                                 T6
        MAQAM_NAMES.ts  identifyAjnas.ts (+ test)                              T7
        sayr/jinsPairs.ts (+ test)                                             T8
      gesture/
        nearestCourse.ts (+ test)                                             T9
        detectPluck.ts (+ test)                                               T10
        detectRake.ts (+ test)                                                T11
        detectMandal.ts (+ test)                                              T12
    hooks/
      deriveHandRoles.ts (+ test)  useQanunEngine.ts                          T16
    components/
      Stage.tsx  StageCover.tsx  TypedSelect.tsx                              T15
      StringField.tsx                                                         T17
      MandalRack.tsx                                                          T18
      QanunHud.tsx  CameraInset.tsx                                           T19
      Controls.tsx                                                            T20
      Qanun.tsx                                                               T21
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/App.css`, `src/test-setup.ts`
- Create: `src/lib/sanity.ts`, `src/lib/sanity.test.ts`

- [ ] **Step 1: Copy the config files that are reused verbatim from theremin**

```bash
cd /Users/yusuf/Projects/qanun
cp ../theremin/tsconfig.json ./tsconfig.json
cp ../theremin/tsconfig.app.json ./tsconfig.app.json
cp ../theremin/tsconfig.node.json ./tsconfig.node.json
cp ../theremin/eslint.config.js ./eslint.config.js
cp ../theremin/vitest.config.ts ./vitest.config.ts
```

- [ ] **Step 2: Write `package.json`** (P1 dependencies only — no electron, no MIDI, no rxjs)

```json
{
  "name": "qanun-app",
  "private": true,
  "version": "0.0.0",
  "description": "Interactive web qanun — hand-tracked Arabic maqam instrument over a webcam.",
  "author": "Yusuf Tessy",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.35",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "tone": "^15.1.22"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "jsdom": "^25.0.1",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 3: Write `vite.config.ts`** (qanun is served at the site root; no Electron base)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Worker format `es` kept for parity with theremin — a future recorder
// sub-plan (P4) reuses its ESM worker.
export default defineConfig({
  base: '/',
  plugins: [react()],
  worker: { format: 'es' }
})
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Qanun</title>
    <meta name="description" content="Interactive web qanun — a hand-tracked Arabic maqam instrument played over your webcam." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/App.css`, `src/test-setup.ts`**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

`src/App.tsx` (placeholder shell — replaced by the real composition in Task 21):
```tsx
import './App.css'

export const App = () => (
  <main className="app-root">
    <h1>Qanun</h1>
  </main>
)
```

`src/index.css`:
```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: #0b0a08; color: #f4f2eb; font-family: system-ui, sans-serif; }
```

`src/App.css`:
```css
.app-root { display: flex; align-items: center; justify-content: center; height: 100%; }
```

`src/test-setup.ts`:
```ts
// Vitest setup. Intentionally empty for now — component-testing matchers
// (@testing-library/jest-dom) may be added by a later sub-plan.
export {}
```

- [ ] **Step 6: Write a trivial sanity unit so `npm test` has a green target**

`src/lib/sanity.ts`:
```ts
export const sanity = (): true => true
```

`src/lib/sanity.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { sanity } from './sanity'

describe('scaffold', () => {
  it('runs the test runner', () => {
    expect(sanity()).toBe(true)
  })
})
```

- [ ] **Step 7: Install and verify the toolchain**

Run: `cd /Users/yusuf/Projects/qanun && npm install`
Expected: installs without error, creates `package-lock.json` and `node_modules/`.

Run: `npm run test:run`
Expected: 1 passing test (`scaffold > runs the test runner`).

Run: `npm run build`
Expected: `tsc -b` passes and Vite produces `dist/` with no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold qanun Vite + React + TS project (P1)"
```

---

## Task 2: Copy & verify the reused foundation modules

Copy the theremin modules the qanun reuses **verbatim, with their tests**, so they arrive already green.

**Files (all copied from `../theremin/src/...`):**
- `src/lib/vision/{constants,loadHandLandmarker,findHandedness,pinchDistance,startCamera,stopCamera,scheduleVideoFrame}.ts`
- `src/lib/oneEuro/{alpha,createLowPass,createOneEuroFilter,types}.ts`
- `src/lib/draw/{projectPoint,drawFingerRing,drawHand,HAND_CONNECTIONS}.ts`
- `src/lib/music/{midiToFreq,freqToMidi,NOTE_NAMES,midiName,clamp01}.ts`
- `src/lib/audio/reverbSize.ts` + `src/lib/audio/reverbSize.test.ts`

- [ ] **Step 1: Copy the vision, oneEuro, and draw modules**

```bash
cd /Users/yusuf/Projects/qanun
mkdir -p src/lib/vision src/lib/oneEuro src/lib/draw src/lib/music src/lib/audio
cp ../theremin/src/lib/vision/{constants,loadHandLandmarker,findHandedness,pinchDistance,startCamera,stopCamera,scheduleVideoFrame}.ts src/lib/vision/
cp ../theremin/src/lib/oneEuro/{alpha,createLowPass,createOneEuroFilter,types}.ts src/lib/oneEuro/
cp ../theremin/src/lib/draw/{projectPoint,drawFingerRing,drawHand,HAND_CONNECTIONS}.ts src/lib/draw/
```

- [ ] **Step 2: Copy the music utilities and the reverb preset (with its test)**

```bash
cd /Users/yusuf/Projects/qanun
cp ../theremin/src/lib/music/{midiToFreq,freqToMidi,NOTE_NAMES,midiName,clamp01}.ts src/lib/music/
cp ../theremin/src/lib/audio/reverbSize.ts src/lib/audio/
cp ../theremin/src/lib/audio/reverbSize.test.ts src/lib/audio/
```

- [ ] **Step 3: Create a local `src/types.ts` providing the shared types the copied files import**

The copied `pinchDistance.ts`, `projectPoint.ts`, etc. import `NormPoint` from `../../types`, and `reverbSize.ts` imports `ReverbSize`. Provide both now (expanded in Task 15).

`src/types.ts`:
```ts
// Shared types used across the app.

export interface NormPoint {
  x: number
  y: number
  z?: number
}

// Reverb preset size (consumed by reverbSize.ts / the audio engine).
export type ReverbSize = 'small' | 'medium' | 'hall'
```

- [ ] **Step 4: Verify the copied modules typecheck and their tests pass**

Run: `npm run test:run`
Expected: the `reverbSize` suite passes alongside `scaffold` (e.g. "honours the medium reverb preset"). No failures.

Run: `npx tsc -b`
Expected: no type errors (confirms the copied files resolve `../../types`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: vendor reused theremin foundation (vision, oneEuro, draw, music utils, reverb)"
```

---

## Task 3: Music types + the jins table

**Files:**
- Create: `src/lib/music/types.ts`
- Create: `src/lib/music/ajnas/JINS.ts`
- Test: `src/lib/music/ajnas/JINS.test.ts`

- [ ] **Step 1: Write the music model types**

`src/lib/music/types.ts`:
```ts
// The pure music model. Pitch convention: semitones from a reference, with
// quarter-tones as half-integers (half-flat = .5). See docs/MUSIC-THEORY.md §2.

// A jins: a 3–5 note melodic cell with one tonicized note.
export interface Jins {
  id: string
  label: string
  // Semitone offsets from the jins tonic; intervals[0] is always 0.
  intervals: readonly number[]
  // Scale degree (1-indexed, within the jins) of the ghammāz — the top note /
  // where the next jins begins. 3 = trichord, 4 = tetrachord, 5 = pentachord.
  ghammazDegree: number
  // The scale degree of the field on which this jins idiomatically roots.
  // 1 for most; 3 for the half-flat-tonic trichords (Sikah). Default 1.
  homeDegree: number
}

// Live mandal tuning: one chosen semitone offset (from the tonic) per scale
// degree. Index d-1 holds the offset for degree d. Length DEGREE_COUNT (7).
export type MandalState = readonly number[]

// One playable string on the field.
export interface Course {
  index: number   // 0-based position in the field, low → high
  degree: number  // 1..7 (scale degree)
  octave: number  // 0-based octave index within the field
  midi: number    // tonicMidi + 12*octave + offset(degree)
  freqHz: number
}

// What the current mandal state spells out.
export interface AjnasIdentity {
  lower: string | null   // jins id of the lower (root) jins
  upper: string | null   // jins id of the upper jins (from the ghammāz)
  maqamName: string      // friendly maqam name, "Lower ▸ Upper", or "custom"
}
```

- [ ] **Step 2: Write the failing test for the jins table**

`src/lib/music/ajnas/JINS.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { JINS, jinsById } from './JINS'

describe('JINS table', () => {
  it('includes the 9 family-head ajnas plus Hijazkar', () => {
    const ids = JINS.map((j) => j.id).sort()
    expect(ids).toEqual(
      ['ajam', 'bayati', 'hijaz', 'hijazkar', 'kurd', 'nahawand', 'nikriz', 'rast', 'saba', 'sikah'].sort()
    )
  })

  it('every jins starts on its tonic (interval 0) with strictly ascending intervals', () => {
    for (const j of JINS) {
      expect(j.intervals[0]).toBe(0)
      for (let i = 1; i < j.intervals.length; i++) {
        expect(j.intervals[i]).toBeGreaterThan(j.intervals[i - 1])
      }
    }
  })

  it('ghammazDegree is 3, 4, or 5 and indexes a real note in the jins', () => {
    for (const j of JINS) {
      expect([3, 4, 5]).toContain(j.ghammazDegree)
      expect(j.intervals.length).toBeGreaterThanOrEqual(j.ghammazDegree)
    }
  })

  it('transcribes the canonical interval vectors (docs/MUSIC-THEORY.md §3)', () => {
    expect(jinsById('rast').intervals).toEqual([0, 2, 3.5, 5, 7])
    expect(jinsById('nahawand').intervals).toEqual([0, 2, 3, 5, 7])
    expect(jinsById('ajam').intervals).toEqual([0, 2, 4, 5, 7])
    expect(jinsById('bayati').intervals).toEqual([0, 1.5, 3, 5])
    expect(jinsById('kurd').intervals).toEqual([0, 1, 3, 5])
    expect(jinsById('hijaz').intervals).toEqual([0, 1, 4, 5])
    expect(jinsById('saba').intervals).toEqual([0, 1.5, 3, 4])
    expect(jinsById('sikah').intervals).toEqual([0, 1.5, 3.5])
    expect(jinsById('nikriz').intervals).toEqual([0, 2, 3, 6, 7])
    expect(jinsById('hijazkar').intervals).toEqual([0, 1, 4, 5])
  })

  it('roots Sikah on the half-flat 3rd degree (homeDegree 3); others on 1', () => {
    expect(jinsById('sikah').homeDegree).toBe(3)
    expect(jinsById('rast').homeDegree).toBe(1)
    expect(jinsById('saba').homeDegree).toBe(1)
  })

  it('marks Saba as a trichord-ghammāz jins (ghammāz on 3)', () => {
    expect(jinsById('saba').ghammazDegree).toBe(3)
    expect(jinsById('sikah').ghammazDegree).toBe(3)
    expect(jinsById('bayati').ghammazDegree).toBe(4)
    expect(jinsById('rast').ghammazDegree).toBe(5)
  })

  it('jinsById throws on an unknown id', () => {
    expect(() => jinsById('nope')).toThrow()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/music/ajnas/JINS.test.ts`
Expected: FAIL — `Cannot find module './JINS'`.

- [ ] **Step 4: Write the jins table**

`src/lib/music/ajnas/JINS.ts`:
```ts
import type { Jins } from '../types'

// The Phase-1 jins core: the 9 ajnas that head maqam families plus Hijazkar.
// Intervals are semitones from the jins tonic (half-flat = .5). Transcribed
// from docs/MUSIC-THEORY.md §3 and docs/research/ajnas-reference.md.
//
// Deferred to a later sub-plan (need the variant mandal positions): Sazkar,
// Nahawand Murassaʿ, Mukhalif Sharqi, Lami, Saba Zamzam, Athar Kurd, Jiharkah,
// Mustaʿar, ʿAjam(3), Upper Rast/Ajam.
export const JINS: readonly Jins[] = [
  { id: 'rast',     label: 'Rast',     intervals: [0, 2, 3.5, 5, 7], ghammazDegree: 5, homeDegree: 1 },
  { id: 'nahawand', label: 'Nahawand', intervals: [0, 2, 3, 5, 7],   ghammazDegree: 5, homeDegree: 1 },
  { id: 'ajam',     label: 'ʿAjam',    intervals: [0, 2, 4, 5, 7],   ghammazDegree: 5, homeDegree: 1 },
  { id: 'nikriz',   label: 'Nikriz',   intervals: [0, 2, 3, 6, 7],   ghammazDegree: 5, homeDegree: 1 },
  { id: 'bayati',   label: 'Bayati',   intervals: [0, 1.5, 3, 5],    ghammazDegree: 4, homeDegree: 1 },
  { id: 'kurd',     label: 'Kurd',     intervals: [0, 1, 3, 5],      ghammazDegree: 4, homeDegree: 1 },
  { id: 'hijaz',    label: 'Hijaz',    intervals: [0, 1, 4, 5],      ghammazDegree: 4, homeDegree: 1 },
  { id: 'hijazkar', label: 'Hijazkar', intervals: [0, 1, 4, 5],      ghammazDegree: 4, homeDegree: 1 },
  { id: 'saba',     label: 'Saba',     intervals: [0, 1.5, 3, 4],    ghammazDegree: 3, homeDegree: 1 },
  { id: 'sikah',    label: 'Sikah',    intervals: [0, 1.5, 3.5],     ghammazDegree: 3, homeDegree: 3 }
]

const BY_ID: ReadonlyMap<string, Jins> = new Map(JINS.map((j) => [j.id, j]))

export const jinsById = (id: string): Jins => {
  const j = BY_ID.get(id)
  if (!j) throw new Error(`Unknown jins id: ${id}`)
  return j
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/music/ajnas/JINS.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/music/types.ts src/lib/music/ajnas/JINS.ts src/lib/music/ajnas/JINS.test.ts
git commit -m "feat: jins table + music model types (9 family heads + Hijazkar)"
```

---

## Task 4: Mandal positions, offset resolver, and cycle

**Files:**
- Create: `src/lib/music/ajnas/MANDALS.ts`
- Test: `src/lib/music/ajnas/MANDALS.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/music/ajnas/MANDALS.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  DEGREE_COUNT,
  DEFAULT_RAST_STATE,
  MANDAL_DEGREES,
  cycleMandal,
  offsetOf,
  positionsForDegree,
  setMandal
} from './MANDALS'

describe('MANDAL_DEGREES (docs/MUSIC-THEORY.md §5)', () => {
  it('has 7 degrees with the spec position sets', () => {
    expect(DEGREE_COUNT).toBe(7)
    expect(positionsForDegree(1)).toEqual([0])
    expect(positionsForDegree(2)).toEqual([1, 1.5, 2])
    expect(positionsForDegree(3)).toEqual([3, 3.5, 4])
    expect(positionsForDegree(4)).toEqual([4, 5, 6])
    expect(positionsForDegree(5)).toEqual([7])
    expect(positionsForDegree(6)).toEqual([8, 8.5, 9])
    expect(positionsForDegree(7)).toEqual([10, 10.5, 11])
  })

  it('marks degrees 1 and 5 as fixed pillars', () => {
    expect(MANDAL_DEGREES[0].fixed).toBe(true)
    expect(MANDAL_DEGREES[4].fixed).toBe(true)
    expect(MANDAL_DEGREES[1].fixed).toBe(false)
  })
})

describe('DEFAULT_RAST_STATE', () => {
  it('is Rast on the tonic: [0, 2, 3.5, 5, 7, 9, 10.5]', () => {
    expect(DEFAULT_RAST_STATE).toEqual([0, 2, 3.5, 5, 7, 9, 10.5])
    expect(DEFAULT_RAST_STATE).toHaveLength(7)
  })
  it('every default offset is a legal position for its degree', () => {
    for (let d = 1; d <= 7; d++) {
      expect(positionsForDegree(d)).toContain(offsetOf(DEFAULT_RAST_STATE, d))
    }
  })
})

describe('offsetOf', () => {
  it('reads the chosen offset for a degree (1-indexed)', () => {
    expect(offsetOf(DEFAULT_RAST_STATE, 1)).toBe(0)
    expect(offsetOf(DEFAULT_RAST_STATE, 3)).toBe(3.5)
    expect(offsetOf(DEFAULT_RAST_STATE, 7)).toBe(10.5)
  })
})

describe('setMandal', () => {
  it('returns a new state with one degree changed', () => {
    const next = setMandal(DEFAULT_RAST_STATE, 3, 3)
    expect(offsetOf(next, 3)).toBe(3)
    expect(next).not.toBe(DEFAULT_RAST_STATE)         // immutable
    expect(offsetOf(DEFAULT_RAST_STATE, 3)).toBe(3.5) // original untouched
  })
})

describe('cycleMandal', () => {
  it('moves the degree to the next higher position', () => {
    // degree 3 default 3.5 → next up is 4 (natural).
    expect(offsetOf(cycleMandal(DEFAULT_RAST_STATE, 3, 1), 3)).toBe(4)
  })
  it('moves the degree to the next lower position', () => {
    // degree 3 default 3.5 → next down is 3 (flat).
    expect(offsetOf(cycleMandal(DEFAULT_RAST_STATE, 3, -1), 3)).toBe(3)
  })
  it('clamps at the top and bottom of a degree (no wrap)', () => {
    const top = setMandal(DEFAULT_RAST_STATE, 2, 2)      // degree 2 highest
    expect(offsetOf(cycleMandal(top, 2, 1), 2)).toBe(2)  // stays at 2
    const bottom = setMandal(DEFAULT_RAST_STATE, 2, 1)   // degree 2 lowest
    expect(offsetOf(cycleMandal(bottom, 2, -1), 2)).toBe(1)
  })
  it('is a no-op on fixed pillar degrees 1 and 5', () => {
    expect(cycleMandal(DEFAULT_RAST_STATE, 1, 1)).toEqual(DEFAULT_RAST_STATE)
    expect(cycleMandal(DEFAULT_RAST_STATE, 5, -1)).toEqual(DEFAULT_RAST_STATE)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/music/ajnas/MANDALS.test.ts`
Expected: FAIL — `Cannot find module './MANDALS'`.

- [ ] **Step 3: Write the implementation**

`src/lib/music/ajnas/MANDALS.ts`:
```ts
import type { MandalState } from '../types'

export const DEGREE_COUNT = 7

export interface MandalDegree {
  degree: number                 // 1..7
  positions: readonly number[]   // ordered low → high (semitone offsets from tonic)
  fixed: boolean                 // true for the pillar degrees (single position)
}

// The qanun mandal positions (docs/MUSIC-THEORY.md §5, spec §2.2), transcribed
// verbatim. Degrees 1 and 5 are fixed pillars in P1. (A later sub-plan that
// adds Sazkar / Nahawand Murassaʿ / Mukhalif gains offset 3 on degree 2 and
// offset 6 on degree 5 — not needed for the P1 jins core.)
export const MANDAL_DEGREES: readonly MandalDegree[] = [
  { degree: 1, positions: [0],            fixed: true },
  { degree: 2, positions: [1, 1.5, 2],    fixed: false },
  { degree: 3, positions: [3, 3.5, 4],    fixed: false },
  { degree: 4, positions: [4, 5, 6],      fixed: false },
  { degree: 5, positions: [7],            fixed: true },
  { degree: 6, positions: [8, 8.5, 9],    fixed: false },
  { degree: 7, positions: [10, 10.5, 11], fixed: false }
]

// Default tuning: Rast on the tonic.
export const DEFAULT_RAST_STATE: MandalState = [0, 2, 3.5, 5, 7, 9, 10.5]

export const positionsForDegree = (degree: number): readonly number[] =>
  MANDAL_DEGREES[degree - 1].positions

export const offsetOf = (state: MandalState, degree: number): number =>
  state[degree - 1]

export const setMandal = (
  state: MandalState,
  degree: number,
  offset: number
): MandalState => {
  const next = state.slice()
  next[degree - 1] = offset
  return next
}

// Move a degree to its next/previous legal position. Clamps at the ends (no
// wrap) so a flick past the top/bottom is a predictable no-op. Fixed pillar
// degrees never move.
export const cycleMandal = (
  state: MandalState,
  degree: number,
  direction: 1 | -1
): MandalState => {
  const md = MANDAL_DEGREES[degree - 1]
  if (md.fixed) return state
  const current = offsetOf(state, degree)
  const i = md.positions.indexOf(current)
  // If the current offset isn't a known position, snap to the nearest end.
  const fromIndex = i === -1 ? (direction === 1 ? -1 : md.positions.length) : i
  const nextIndex = Math.min(md.positions.length - 1, Math.max(0, fromIndex + direction))
  return setMandal(state, degree, md.positions[nextIndex])
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/music/ajnas/MANDALS.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/ajnas/MANDALS.ts src/lib/music/ajnas/MANDALS.test.ts
git commit -m "feat: mandal positions + offset resolver + cycle (spec literal table)"
```

---

## Task 5: Reachability invariant

The spec's key correctness guarantee: **every jins in the P1 core is producible from the mandal positions.** This test is what would catch a position-set gap (and is the gate for adding deferred ajnas later).

**Files:**
- Create: `src/lib/music/ajnas/reachability.ts`
- Test: `src/lib/music/ajnas/reachability.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/music/ajnas/reachability.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { JINS, jinsById } from './JINS'
import { reachableStartDegrees, isJinsReachable } from './reachability'

describe('jins reachability against the mandal positions', () => {
  it('EVERY jins in the P1 core is reachable', () => {
    for (const j of JINS) {
      expect(isJinsReachable(j), `${j.id} must be reachable`).toBe(true)
    }
  })

  it('roots most ajnas at degree 1', () => {
    expect(reachableStartDegrees(jinsById('rast'))).toContain(1)
    expect(reachableStartDegrees(jinsById('hijaz'))).toContain(1)
    expect(reachableStartDegrees(jinsById('nikriz'))).toContain(1) // needs degree-4 offset 6
    expect(reachableStartDegrees(jinsById('saba'))).toContain(1)   // needs degree-4 offset 4
  })

  it('can place Sikah on the half-flat 3rd degree (degree 3)', () => {
    // Sikah is also mathematically reachable from degree 1 (0, 1.5, 3.5 are all
    // legal positions); identifyAjnas uses homeDegree to keep it off degree 1.
    expect(reachableStartDegrees(jinsById('sikah'))).toContain(3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/music/ajnas/reachability.test.ts`
Expected: FAIL — `Cannot find module './reachability'`.

- [ ] **Step 3: Write the implementation**

`src/lib/music/ajnas/reachability.ts`:
```ts
import type { Jins } from '../types'
import { DEGREE_COUNT, positionsForDegree } from './MANDALS'

// A jins is reachable at start degree s if there is a choice of mandal
// positions such that, placing the jins tonic on degree s, each successive
// note lands on a legal position of the corresponding higher degree. We only
// consider start degrees where the whole jins fits within the 7 field degrees
// (s + length - 1 <= 7), so no octave wrap is needed for the P1 core.
export const reachableStartDegrees = (jins: Jins): number[] => {
  const out: number[] = []
  const len = jins.intervals.length
  for (let s = 1; s + len - 1 <= DEGREE_COUNT; s++) {
    // Choose a base offset b from the start degree's positions, then require
    // b + interval[i] to be a legal position of degree (s + i) for every note.
    const baseChoices = positionsForDegree(s)
    const ok = baseChoices.some((b) =>
      jins.intervals.every((interval, i) =>
        positionsForDegree(s + i).includes(b + interval)
      )
    )
    if (ok) out.push(s)
  }
  return out
}

export const isJinsReachable = (jins: Jins): boolean =>
  reachableStartDegrees(jins).length > 0
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/music/ajnas/reachability.test.ts`
Expected: PASS — all 10 jins reachable; Sikah only at degree 3.

> If any jins fails here, the position sets (Task 4) are the thing to revisit — that is the design feedback loop the spec describes. For the P1 core they should all pass as written.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/ajnas/reachability.ts src/lib/music/ajnas/reachability.test.ts
git commit -m "feat: reachability invariant — every P1 jins is producible from the mandals"
```

---

## Task 6: buildField

**Files:**
- Create: `src/lib/music/buildField.ts`
- Test: `src/lib/music/buildField.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/music/buildField.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildField, DEFAULT_TONIC_MIDI, FIELD_OCTAVES } from './buildField'
import { DEFAULT_RAST_STATE, setMandal } from './ajnas/MANDALS'
import { midiToFreq } from './midiToFreq'

describe('buildField', () => {
  it('produces 7 courses per octave across FIELD_OCTAVES', () => {
    const field = buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
    expect(field).toHaveLength(7 * FIELD_OCTAVES)
    expect(FIELD_OCTAVES).toBe(4)
  })

  it('indexes courses 0..n-1 in order with correct degree/octave labels', () => {
    const field = buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
    field.forEach((c, i) => expect(c.index).toBe(i))
    expect(field[0]).toMatchObject({ degree: 1, octave: 0 })
    expect(field[6]).toMatchObject({ degree: 7, octave: 0 })
    expect(field[7]).toMatchObject({ degree: 1, octave: 1 })
  })

  it('places the first course at the tonic and computes Rast-on-C midis', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    // Rast on C3 (MIDI 48): C, D, E half-flat, F, G, A, B half-flat.
    expect(field.slice(0, 7).map((c) => c.midi)).toEqual([48, 50, 51.5, 53, 55, 57, 58.5])
    // Next octave starts a clean 12 above.
    expect(field[7].midi).toBe(60)
  })

  it('derives freqHz from midi via midiToFreq', () => {
    const field = buildField({ tonicMidi: 48, mandalState: DEFAULT_RAST_STATE })
    expect(field[0].freqHz).toBeCloseTo(midiToFreq(48), 6)
    expect(field[2].freqHz).toBeCloseTo(midiToFreq(51.5), 6) // quarter-tone
  })

  it('is non-decreasing in midi for ANY mandal state (string order = degree order)', () => {
    // Extreme state: degree 3 natural (4) and degree 4 dim (4) collide in pitch.
    let state = setMandal(DEFAULT_RAST_STATE, 3, 4)
    state = setMandal(state, 4, 4)
    const field = buildField({ tonicMidi: 48, mandalState: state })
    for (let i = 1; i < field.length; i++) {
      expect(field[i].midi).toBeGreaterThanOrEqual(field[i - 1].midi)
    }
  })

  it('retunes the whole field when a mandal changes (every octave follows)', () => {
    const lowered = setMandal(DEFAULT_RAST_STATE, 3, 3) // E half-flat → E flat
    const field = buildField({ tonicMidi: 48, mandalState: lowered })
    expect(field[2].midi).toBe(51)   // degree 3, octave 0
    expect(field[9].midi).toBe(63)   // degree 3, octave 1 — also moved
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/music/buildField.test.ts`
Expected: FAIL — `Cannot find module './buildField'`.

- [ ] **Step 3: Write the implementation**

`src/lib/music/buildField.ts`:
```ts
import type { Course, MandalState } from './types'
import { DEGREE_COUNT, offsetOf } from './ajnas/MANDALS'
import { midiToFreq } from './midiToFreq'

// Anchor the field low enough to span the qanun's working range. C3 = MIDI 48;
// with 4 octaves the field reaches ~B♭6. The visible window can be narrowed in
// the component without changing this model.
export const DEFAULT_TONIC_MIDI = 48
export const FIELD_OCTAVES = 4

export interface BuildFieldArgs {
  tonicMidi: number
  mandalState: MandalState
  octaveCount?: number
}

// Lay out the scale-locked string field: for each octave, one course per scale
// degree, ordered by (octave, degree) — the physical string order on a qanun.
// A glide across this array runs the current maqam by construction.
export const buildField = ({
  tonicMidi,
  mandalState,
  octaveCount = FIELD_OCTAVES
}: BuildFieldArgs): Course[] => {
  const courses: Course[] = []
  let index = 0
  for (let octave = 0; octave < octaveCount; octave++) {
    for (let degree = 1; degree <= DEGREE_COUNT; degree++) {
      const midi = tonicMidi + 12 * octave + offsetOf(mandalState, degree)
      courses.push({ index, degree, octave, midi, freqHz: midiToFreq(midi) })
      index++
    }
  }
  return courses
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/music/buildField.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/buildField.ts src/lib/music/buildField.test.ts
git commit -m "feat: buildField — scale-locked course field from tonic + mandal state"
```

---

## Task 7: identifyAjnas + maqam names

**Files:**
- Create: `src/lib/music/MAQAM_NAMES.ts`
- Create: `src/lib/music/identifyAjnas.ts`
- Test: `src/lib/music/identifyAjnas.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/music/identifyAjnas.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { identifyAjnas } from './identifyAjnas'
import type { MandalState } from './types'

// Canonical mandal states for the core maqamat (degree 1..7 offsets).
const RAST: MandalState    = [0, 2, 3.5, 5, 7, 9, 10.5]
const SUZNAK: MandalState  = [0, 2, 3.5, 5, 7, 8, 11]   // Rast + Hijaz on 5
const NAHAWAND: MandalState = [0, 2, 3, 5, 7, 8, 10]    // Nahawand + Kurd on 5
const BAYATI: MandalState  = [0, 1.5, 3, 5, 7, 8, 10]   // Bayati + Nahawand on 4
const HIJAZ: MandalState   = [0, 1, 4, 5, 7, 8, 10]     // Hijaz + Nahawand on 4
const KURD: MandalState    = [0, 1, 3, 5, 7, 8, 10]     // Kurd + Nahawand on 4
const NIKRIZ: MandalState  = [0, 2, 3, 6, 7, 9, 10]     // Nikriz + Nahawand on 5
const SABA: MandalState    = [0, 1.5, 3, 4, 7, 8, 11]   // Saba + Hijaz on 3

describe('identifyAjnas — round-trips the core maqamat', () => {
  it('names Maqam Rast', () => {
    const id = identifyAjnas(RAST)
    expect(id.lower).toBe('rast')
    expect(id.maqamName).toBe('Maqam Rast')
  })
  it('names Maqam Suznak (Rast + Hijaz on 5)', () => {
    const id = identifyAjnas(SUZNAK)
    expect(id.lower).toBe('rast')
    expect(id.upper).toBe('hijaz')
    expect(id.maqamName).toBe('Maqam Suznak')
  })
  it('names Maqam Nahawand', () => {
    expect(identifyAjnas(NAHAWAND).maqamName).toBe('Maqam Nahawand')
  })
  it('names Maqam Bayati', () => {
    const id = identifyAjnas(BAYATI)
    expect(id.lower).toBe('bayati')
    expect(id.maqamName).toBe('Maqam Bayati')
  })
  it('names Maqam Hijaz', () => {
    expect(identifyAjnas(HIJAZ).maqamName).toBe('Maqam Hijaz')
  })
  it('names Maqam Kurd (distinct from Hijaz by the 3rd)', () => {
    const id = identifyAjnas(KURD)
    expect(id.lower).toBe('kurd')
    expect(id.maqamName).toBe('Maqam Kurd')
  })
  it('names Maqam Nikriz', () => {
    expect(identifyAjnas(NIKRIZ).maqamName).toBe('Maqam Nikriz')
  })
  it('names Maqam Saba (ghammāz on 3, upper Hijaz)', () => {
    const id = identifyAjnas(SABA)
    expect(id.lower).toBe('saba')
    expect(id.upper).toBe('hijaz')
    expect(id.maqamName).toBe('Maqam Saba')
  })
})

describe('identifyAjnas — fallbacks', () => {
  it('reports the ajnas pair when there is no named maqam', () => {
    // Rast lower with a Kurd-shaped upper on 5 is not a catalogued P1 maqam.
    const RAST_KURD: MandalState = [0, 2, 3.5, 5, 7, 8, 10]
    const id = identifyAjnas(RAST_KURD)
    expect(id.lower).toBe('rast')
    expect(id.upper).toBe('kurd')
    expect(id.maqamName).toBe('Rast ▸ Kurd')
  })
  it('reports "custom" when the lower degrees match no jins', () => {
    const WEIRD: MandalState = [0, 1.5, 4, 6, 7, 8.5, 11]
    expect(identifyAjnas(WEIRD).maqamName).toBe('custom')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/music/identifyAjnas.test.ts`
Expected: FAIL — `Cannot find module './identifyAjnas'`.

- [ ] **Step 3: Write the maqam-name table**

`src/lib/music/MAQAM_NAMES.ts`:
```ts
// Friendly maqam names keyed by (lower jins id, upper jins id, ghammāz degree).
// Phase-1 set — the degree-1-rooted families plus Saba (ghammāz on 3).
export interface MaqamNameEntry {
  lower: string
  upper: string
  ghammazDegree: number
  name: string
}

export const MAQAM_NAMES: readonly MaqamNameEntry[] = [
  { lower: 'rast',     upper: 'rast',     ghammazDegree: 5, name: 'Maqam Rast' },
  { lower: 'rast',     upper: 'nahawand', ghammazDegree: 5, name: 'Maqam Rast' },
  { lower: 'rast',     upper: 'hijaz',    ghammazDegree: 5, name: 'Maqam Suznak' },
  { lower: 'nahawand', upper: 'kurd',     ghammazDegree: 5, name: 'Maqam Nahawand' },
  { lower: 'nahawand', upper: 'hijaz',    ghammazDegree: 5, name: 'Maqam Nahawand' },
  { lower: 'bayati',   upper: 'nahawand', ghammazDegree: 4, name: 'Maqam Bayati' },
  { lower: 'bayati',   upper: 'rast',     ghammazDegree: 4, name: 'Maqam Bayati' },
  { lower: 'hijaz',    upper: 'nahawand', ghammazDegree: 4, name: 'Maqam Hijaz' },
  { lower: 'hijaz',    upper: 'rast',     ghammazDegree: 4, name: 'Maqam Hijaz' },
  { lower: 'kurd',     upper: 'nahawand', ghammazDegree: 4, name: 'Maqam Kurd' },
  { lower: 'nikriz',   upper: 'nahawand', ghammazDegree: 5, name: 'Maqam Nikriz' },
  { lower: 'saba',     upper: 'hijaz',    ghammazDegree: 3, name: 'Maqam Saba' }
]

export const lookupMaqamName = (
  lower: string,
  upper: string,
  ghammazDegree: number
): string | null =>
  MAQAM_NAMES.find(
    (m) => m.lower === lower && m.upper === upper && m.ghammazDegree === ghammazDegree
  )?.name ?? null
```

- [ ] **Step 4: Write `identifyAjnas`**

`src/lib/music/identifyAjnas.ts`:
```ts
import type { AjnasIdentity, Jins, MandalState } from './types'
import { JINS, jinsById } from './ajnas/JINS'
import { offsetOf } from './ajnas/MANDALS'
import { lookupMaqamName } from './MAQAM_NAMES'

// Extended degree offsets relative to the tonic, degrees 1..9 (8 and 9 wrap
// into the next octave) so a pentachord upper jins on the ghammāz can be read.
const extendedOffsets = (state: MandalState): number[] => {
  const base = [1, 2, 3, 4, 5, 6, 7].map((d) => offsetOf(state, d))
  return [...base, 12 + offsetOf(state, 1), 12 + offsetOf(state, 2)]
}

const arraysEqual = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

// Find the jins whose full interval vector equals the field offsets starting at
// `startDegree` (rebased to 0). Prefer the LONGEST exact match; break ties by
// JINS declaration order. `homeFilter` restricts to jins that idiomatically
// root at that degree (so the half-flat-tonic trichords aren't matched at 1).
const matchJins = (
  offsets: readonly number[],
  startDegree: number,
  homeFilter: (j: Jins) => boolean
): Jins | null => {
  const base = offsets[startDegree - 1]
  const rebased = offsets.slice(startDegree - 1).map((o) => o - base)
  const candidates = JINS.filter(homeFilter)
    .filter((j) => j.intervals.length <= rebased.length)
    .filter((j) => arraysEqual(j.intervals, rebased.slice(0, j.intervals.length)))
    .sort((a, b) => b.intervals.length - a.intervals.length)
  return candidates[0] ?? null
}

export const identifyAjnas = (state: MandalState): AjnasIdentity => {
  const offsets = extendedOffsets(state)

  // Lower jins roots on degree 1 (only jins with homeDegree 1 qualify).
  const lower = matchJins(offsets, 1, (j) => j.homeDegree === 1)
  if (!lower) return { lower: null, upper: null, maqamName: 'custom' }

  // Upper jins roots on the lower jins's ghammāz degree. Allow any jins
  // (the upper jins of the core maqamat are all family heads).
  const upper = matchJins(offsets, lower.ghammazDegree, () => true)

  if (!upper) {
    return { lower: lower.id, upper: null, maqamName: jinsById(lower.id).label }
  }

  const named = lookupMaqamName(lower.id, upper.id, lower.ghammazDegree)
  const maqamName = named ?? `${lower.label} ▸ ${upper.label}`
  return { lower: lower.id, upper: upper.id, maqamName }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/music/identifyAjnas.test.ts`
Expected: PASS — all 8 maqamat round-trip; both fallbacks correct.

- [ ] **Step 6: Commit**

```bash
git add src/lib/music/MAQAM_NAMES.ts src/lib/music/identifyAjnas.ts src/lib/music/identifyAjnas.test.ts
git commit -m "feat: identifyAjnas — name the core maqamat from mandal state (round-trips)"
```

---

## Task 8: Jins-pair quick-swaps

**Files:**
- Create: `src/lib/music/sayr/jinsPairs.ts`
- Test: `src/lib/music/sayr/jinsPairs.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/music/sayr/jinsPairs.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  JINS_PAIRS,
  EXCLUDED_PAIRS,
  applyJinsPair,
  isPairActive
} from './jinsPairs'
import { DEFAULT_RAST_STATE, offsetOf, setMandal } from '../ajnas/MANDALS'
import type { MandalState } from '../types'

const BAYATI: MandalState = [0, 1.5, 3, 5, 7, 8, 10]

describe('JINS_PAIRS — the P1 single-mandal quick-swaps', () => {
  it('contains exactly Bayati↔Saba and Hijaz↔Hijazkar', () => {
    expect(JINS_PAIRS.map((p) => p.id).sort()).toEqual(['bayati-saba', 'hijaz-hijazkar'])
  })

  it('each pair flips exactly one degree between two legal positions', () => {
    for (const p of JINS_PAIRS) {
      expect([1, 2, 3, 4, 5, 6, 7]).toContain(p.degree)
      expect(p.offsetA).not.toBe(p.offsetB)
    }
  })

  it('Bayati↔Saba lowers the 4th degree (5 ↔ 4)', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect(pair.degree).toBe(4)
    expect([pair.offsetA, pair.offsetB].sort()).toEqual([4, 5])
  })

  it('Hijaz↔Hijazkar raises the leading tone, degree 7 (10 ↔ 11)', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'hijaz-hijazkar')!
    expect(pair.degree).toBe(7)
    expect([pair.offsetA, pair.offsetB].sort()).toEqual([10, 11])
  })

  it('deliberately EXCLUDES Nahawand↔Nikriz as a fluid pair', () => {
    expect(EXCLUDED_PAIRS).toContain('nahawand-nikriz')
    expect(JINS_PAIRS.map((p) => p.id)).not.toContain('nahawand-nikriz')
  })
})

describe('applyJinsPair — toggles the one mandal, bidirectionally', () => {
  it('Bayati → Saba lowers degree 4 to 4 and leaves the rest', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    const toSaba = applyJinsPair(BAYATI, pair)
    expect(offsetOf(toSaba, 4)).toBe(4)
    expect(toSaba.filter((_, i) => i !== 3)).toEqual(BAYATI.filter((_, i) => i !== 3))
  })

  it('round-trips (apply twice returns the original)', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect(applyJinsPair(applyJinsPair(BAYATI, pair), pair)).toEqual(BAYATI)
  })

  it('snaps to offsetA from an unrelated value', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'hijaz-hijazkar')!
    const odd = setMandal(DEFAULT_RAST_STATE, 7, 10.5) // neither 10 nor 11
    expect(offsetOf(applyJinsPair(odd, pair), 7)).toBe(pair.offsetA)
  })
})

describe('isPairActive', () => {
  it('is true when the degree sits on either pole of the pair', () => {
    const pair = JINS_PAIRS.find((p) => p.id === 'bayati-saba')!
    expect(isPairActive(BAYATI, pair)).toBe(true)              // degree 4 = 5
    expect(isPairActive(applyJinsPair(BAYATI, pair), pair)).toBe(true) // degree 4 = 4
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/music/sayr/jinsPairs.test.ts`
Expected: FAIL — `Cannot find module './jinsPairs'`.

- [ ] **Step 3: Write the implementation**

`src/lib/music/sayr/jinsPairs.ts`:
```ts
import type { MandalState } from '../types'
import { offsetOf, setMandal } from '../ajnas/MANDALS'

// A jins pair is a single-mandal flip between two named ajnas (spec §2.4).
export interface JinsPair {
  id: string
  fromLabel: string
  toLabel: string
  degree: number    // the one mandal degree that moves
  offsetA: number   // the "from" pole
  offsetB: number   // the "to" pole
}

// Phase-1 pairs realizable with the literal mandal table. The other three
// canonical pairs (Rast↔Sazkar, Nahawand↔Nahawand Murassaʿ, Sikah↔Mukhalif)
// need the deferred variant ajnas + extra mandal positions — add them with
// those ajnas in a later sub-plan.
export const JINS_PAIRS: readonly JinsPair[] = [
  { id: 'bayati-saba',     fromLabel: 'Bayati', toLabel: 'Saba',     degree: 4, offsetA: 5,  offsetB: 4 },
  { id: 'hijaz-hijazkar',  fromLabel: 'Hijaz',  toLabel: 'Hijazkar', degree: 7, offsetA: 10, offsetB: 11 }
]

// Documented non-pair: same one-note mechanism, but idiomatically a dramatic
// contrast rather than a fluid swap (spec §2.4 / sayr-reference §5).
export const EXCLUDED_PAIRS: readonly string[] = ['nahawand-nikriz']

// Toggle the pair's degree between its two poles. If the degree sits on
// neither pole, snap to offsetA (a deterministic, single-flip result).
export const applyJinsPair = (state: MandalState, pair: JinsPair): MandalState => {
  const current = offsetOf(state, pair.degree)
  const next = current === pair.offsetA ? pair.offsetB : pair.offsetA
  return setMandal(state, pair.degree, next)
}

export const isPairActive = (state: MandalState, pair: JinsPair): boolean => {
  const current = offsetOf(state, pair.degree)
  return current === pair.offsetA || current === pair.offsetB
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/music/sayr/jinsPairs.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/music/sayr/jinsPairs.ts src/lib/music/sayr/jinsPairs.test.ts
git commit -m "feat: jins-pair quick-swaps (Bayati↔Saba, Hijaz↔Hijazkar) + exclusions"
```

---

## Task 9: nearestCourse (x → string, with snap)

**Files:**
- Create: `src/lib/gesture/nearestCourse.ts`
- Test: `src/lib/gesture/nearestCourse.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/gesture/nearestCourse.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { nearestCourse, courseScreenX, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from './nearestCourse'

const ARGS = { courseCount: 28, fieldLeft: PLAY_FIELD_LEFT, fieldRight: PLAY_FIELD_RIGHT }

describe('nearestCourse', () => {
  it('snaps the centre of a cell to that course (round-trip with courseScreenX)', () => {
    for (const i of [0, 1, 13, 27]) {
      const x = courseScreenX(i, ARGS.courseCount, ARGS.fieldLeft, ARGS.fieldRight)
      expect(nearestCourse({ x, ...ARGS })).toBe(i)
    }
  })

  it('is forgiving — a point anywhere inside a cell snaps to that course', () => {
    const w = (PLAY_FIELD_RIGHT - PLAY_FIELD_LEFT) / 28
    const centre = courseScreenX(10, 28, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT)
    expect(nearestCourse({ x: centre + w * 0.4, ...ARGS })).toBe(10)
    expect(nearestCourse({ x: centre - w * 0.4, ...ARGS })).toBe(10)
  })

  it('clamps below the field to course 0 and above to the last course', () => {
    expect(nearestCourse({ x: -1, ...ARGS })).toBe(0)
    expect(nearestCourse({ x: 0.05, ...ARGS })).toBe(0)  // left of the play field
    expect(nearestCourse({ x: 2, ...ARGS })).toBe(27)
  })

  it('the play field starts to the right of the mandal zone', () => {
    expect(PLAY_FIELD_LEFT).toBeGreaterThanOrEqual(0.18)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/gesture/nearestCourse.test.ts`
Expected: FAIL — `Cannot find module './nearestCourse'`.

- [ ] **Step 3: Write the implementation**

`src/lib/gesture/nearestCourse.ts`:
```ts
// The play field occupies the screen to the right of the mandal zone
// (left ~18%). x is a normalized screen coordinate (0 = screen-left), already
// mirrored by the caller. Courses are uniform, cell-centred cells.
export const PLAY_FIELD_LEFT = 0.2
export const PLAY_FIELD_RIGHT = 1.0

export interface NearestCourseArgs {
  x: number
  courseCount: number
  fieldLeft: number
  fieldRight: number
}

// Screen x of the centre of course `index`.
export const courseScreenX = (
  index: number,
  courseCount: number,
  fieldLeft: number,
  fieldRight: number
): number => {
  const cell = (fieldRight - fieldLeft) / courseCount
  return fieldLeft + (index + 0.5) * cell
}

// Nearest course to x (snap-to-nearest). Clamps to [0, courseCount-1].
export const nearestCourse = ({ x, courseCount, fieldLeft, fieldRight }: NearestCourseArgs): number => {
  const cell = (fieldRight - fieldLeft) / courseCount
  const raw = Math.floor((x - fieldLeft) / cell)
  return Math.min(courseCount - 1, Math.max(0, raw))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/gesture/nearestCourse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gesture/nearestCourse.ts src/lib/gesture/nearestCourse.test.ts
git commit -m "feat: nearestCourse — x → nearest string with snap + mandal-zone offset"
```

---

## Task 10: detectPluck (pinch-onset)

**Files:**
- Create: `src/lib/gesture/detectPluck.ts`
- Test: `src/lib/gesture/detectPluck.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/gesture/detectPluck.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createPluckDetector } from './detectPluck'

describe('createPluckDetector — pinch onset edge', () => {
  it('emits one pluck on the open→closed transition, sampling the course at onset', () => {
    const d = createPluckDetector()
    expect(d.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0.0 })).toBeNull() // open
    const ev = d.update({ pinchDist: 0.02, courseIndex: 5, tNow: 0.05 })        // closed
    expect(ev).not.toBeNull()
    expect(ev!.courseIndex).toBe(5) // sampled at the onset frame
  })

  it('does NOT re-emit while the pinch stays closed', () => {
    const d = createPluckDetector()
    d.update({ pinchDist: 0.12, courseIndex: 3, tNow: 0 })
    expect(d.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.05 })).not.toBeNull()
    expect(d.update({ pinchDist: 0.01, courseIndex: 3, tNow: 0.10 })).toBeNull()
    expect(d.update({ pinchDist: 0.02, courseIndex: 3, tNow: 0.15 })).toBeNull()
  })

  it('re-arms after the pinch opens past the hysteresis threshold', () => {
    const d = createPluckDetector()
    d.update({ pinchDist: 0.12, courseIndex: 1, tNow: 0 })
    expect(d.update({ pinchDist: 0.02, courseIndex: 1, tNow: 0.05 })).not.toBeNull()
    d.update({ pinchDist: 0.12, courseIndex: 1, tNow: 0.10 }) // open again
    expect(d.update({ pinchDist: 0.02, courseIndex: 1, tNow: 0.15 })).not.toBeNull()
  })

  it('derives a higher velocity from a faster close, clamped to [0,1]', () => {
    const slow = createPluckDetector()
    slow.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    const slowEv = slow.update({ pinchDist: 0.04, courseIndex: 0, tNow: 0.20 })
    const fast = createPluckDetector()
    fast.update({ pinchDist: 0.12, courseIndex: 0, tNow: 0 })
    const fastEv = fast.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0.02 })
    expect(fastEv!.velocity).toBeGreaterThan(slowEv!.velocity)
    expect(fastEv!.velocity).toBeLessThanOrEqual(1)
    expect(slowEv!.velocity).toBeGreaterThan(0)
  })

  it('reset() clears the pinch state', () => {
    const d = createPluckDetector()
    d.update({ pinchDist: 0.02, courseIndex: 0, tNow: 0 }) // starts closed → no prior open, no emit
    d.reset()
    d.update({ pinchDist: 0.12, courseIndex: 2, tNow: 0.05 })
    expect(d.update({ pinchDist: 0.02, courseIndex: 2, tNow: 0.10 })).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/gesture/detectPluck.test.ts`
Expected: FAIL — `Cannot find module './detectPluck'`.

- [ ] **Step 3: Write the implementation**

`src/lib/gesture/detectPluck.ts`:
```ts
// Pinch-onset pluck detector. A pluck fires on the open→closed edge of the
// thumb–index pinch; the target course is sampled at that onset frame (so
// index drift during the pinch doesn't move the note). Hysteresis: the pinch
// must re-open past `openThreshold` before it can fire again.
export interface PluckEvent {
  courseIndex: number
  velocity: number
}

export interface PluckDetectorOptions {
  closeThreshold?: number // pinch distance below which the pinch is "closed"
  openThreshold?: number  // distance above which it re-arms (> closeThreshold)
  velocityRef?: number    // closing speed (units/sec) that maps to velocity 1
  minVelocity?: number    // floor when timing is unavailable
}

export interface PluckDetector {
  update: (args: { pinchDist: number; courseIndex: number; tNow: number }) => PluckEvent | null
  reset: () => void
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

export const createPluckDetector = ({
  closeThreshold = 0.05,
  openThreshold = 0.07,
  velocityRef = 1.5,
  minVelocity = 0.4
}: PluckDetectorOptions = {}): PluckDetector => {
  let closed = false
  let prevDist: number | null = null
  let prevT: number | null = null

  const update = ({
    pinchDist,
    courseIndex,
    tNow
  }: {
    pinchDist: number
    courseIndex: number
    tNow: number
  }): PluckEvent | null => {
    let event: PluckEvent | null = null
    if (!closed && pinchDist < closeThreshold) {
      // Onset edge.
      closed = true
      let velocity = minVelocity
      if (prevDist !== null && prevT !== null) {
        const dt = Math.max(1e-3, tNow - prevT)
        const speed = (prevDist - pinchDist) / dt
        velocity = clamp01(speed / velocityRef)
        if (velocity < minVelocity) velocity = minVelocity
      }
      event = { courseIndex, velocity }
    } else if (closed && pinchDist > openThreshold) {
      closed = false
    }
    prevDist = pinchDist
    prevT = tNow
    return event
  }

  const reset = (): void => {
    closed = false
    prevDist = null
    prevT = null
  }

  return { update, reset }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/gesture/detectPluck.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gesture/detectPluck.ts src/lib/gesture/detectPluck.test.ts
git commit -m "feat: detectPluck — pinch-onset pluck with hysteresis + close-speed velocity"
```

---

## Task 11: detectRake (cross-velocity glissando)

**Files:**
- Create: `src/lib/gesture/detectRake.ts`
- Test: `src/lib/gesture/detectRake.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/gesture/detectRake.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createRakeDetector } from './detectRake'

describe('createRakeDetector — cross-velocity glissando', () => {
  it('on a fast sweep, plucks every course crossed since the last frame', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    expect(r.update({ courseIndex: 2, tNow: 0 })).toEqual([])      // first frame primes
    const crossed = r.update({ courseIndex: 5, tNow: 0.05 })       // 3 courses in 50ms
    expect(crossed).toEqual([3, 4, 5])
  })

  it('emits leftward sweeps in crossing order', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    r.update({ courseIndex: 6, tNow: 0 })
    expect(r.update({ courseIndex: 3, tNow: 0.05 })).toEqual([5, 4, 3])
  })

  it('stays silent on slow repositioning (below the speed threshold)', () => {
    const r = createRakeDetector({ sensitivity: 'full' })
    r.update({ courseIndex: 2, tNow: 0 })
    expect(r.update({ courseIndex: 3, tNow: 1.0 })).toEqual([]) // 1 course / sec
  })

  it('off → never rakes', () => {
    const r = createRakeDetector({ sensitivity: 'off' })
    r.update({ courseIndex: 0, tNow: 0 })
    expect(r.update({ courseIndex: 20, tNow: 0.05 })).toEqual([])
  })

  it('subtle needs a faster sweep than full to trigger', () => {
    const make = (s: 'subtle' | 'full') => {
      const r = createRakeDetector({ sensitivity: s })
      r.update({ courseIndex: 0, tNow: 0 })
      return r.update({ courseIndex: 2, tNow: 0.2 }) // 10 courses/sec
    }
    expect(make('full').length).toBeGreaterThan(0)  // full triggers
    expect(make('subtle')).toEqual([])              // subtle does not
  })

  it('setSensitivity changes the threshold at runtime', () => {
    const r = createRakeDetector({ sensitivity: 'off' })
    r.update({ courseIndex: 0, tNow: 0 })
    r.setSensitivity('full')
    expect(r.update({ courseIndex: 3, tNow: 0.05 })).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/gesture/detectRake.test.ts`
Expected: FAIL — `Cannot find module './detectRake'`.

- [ ] **Step 3: Write the implementation**

`src/lib/gesture/detectRake.ts`:
```ts
// Rake (glissando) detector. When the playing fingertip crosses course
// boundaries fast enough, each newly crossed course is plucked in turn. Speed
// is measured in courses/second; the threshold is set by sensitivity so
// beginners avoid accidental glissandos ("subtle") and pros can rip ("full").
export type RakeSensitivity = 'off' | 'subtle' | 'full'

// Courses/second a crossing must exceed to register as a rake. "subtle" needs
// a deliberately fast sweep; "full" triggers easily.
const THRESHOLD: Record<RakeSensitivity, number> = {
  off: Infinity,
  subtle: 12,
  full: 4
}

export interface RakeDetectorOptions {
  sensitivity?: RakeSensitivity
}

export interface RakeDetector {
  update: (args: { courseIndex: number; tNow: number }) => number[]
  setSensitivity: (s: RakeSensitivity) => void
  reset: () => void
}

export const createRakeDetector = ({
  sensitivity = 'subtle'
}: RakeDetectorOptions = {}): RakeDetector => {
  let current: RakeSensitivity = sensitivity
  let prevIndex: number | null = null
  let prevT: number | null = null

  const update = ({ courseIndex, tNow }: { courseIndex: number; tNow: number }): number[] => {
    if (prevIndex === null || prevT === null) {
      prevIndex = courseIndex
      prevT = tNow
      return []
    }
    const delta = courseIndex - prevIndex
    const dt = Math.max(1e-3, tNow - prevT)
    const speed = Math.abs(delta) / dt
    const out: number[] = []
    if (delta !== 0 && speed >= THRESHOLD[current]) {
      const step = delta > 0 ? 1 : -1
      for (let c = prevIndex + step; step > 0 ? c <= courseIndex : c >= courseIndex; c += step) {
        out.push(c)
      }
    }
    prevIndex = courseIndex
    prevT = tNow
    return out
  }

  const setSensitivity = (s: RakeSensitivity): void => {
    current = s
  }

  const reset = (): void => {
    prevIndex = null
    prevT = null
  }

  return { update, setSensitivity, reset }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/gesture/detectRake.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gesture/detectRake.ts src/lib/gesture/detectRake.test.ts
git commit -m "feat: detectRake — cross-velocity glissando with off/subtle/full sensitivity"
```

---

## Task 12: detectMandal (zone + lever + flick)

**Files:**
- Create: `src/lib/gesture/detectMandal.ts`
- Test: `src/lib/gesture/detectMandal.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/gesture/detectMandal.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  MANDAL_ZONE_RIGHT,
  isInMandalZone,
  mandalLeverFromY,
  createMandalGesture
} from './detectMandal'

describe('isInMandalZone', () => {
  it('is true in the far-left strip, false in the play field', () => {
    expect(isInMandalZone(0.05)).toBe(true)
    expect(isInMandalZone(MANDAL_ZONE_RIGHT - 0.001)).toBe(true)
    expect(isInMandalZone(0.5)).toBe(false)
  })
})

describe('mandalLeverFromY', () => {
  it('maps the bottom of the zone to degree 1 and the top to degree 7', () => {
    expect(mandalLeverFromY(0.98)).toBe(1) // bottom → low degree
    expect(mandalLeverFromY(0.02)).toBe(7) // top → high degree
  })
  it('partitions y into 7 contiguous lever bands', () => {
    const degrees = [0.07, 0.21, 0.35, 0.5, 0.64, 0.78, 0.92].map((y) => mandalLeverFromY(y))
    expect(degrees).toEqual([7, 6, 5, 4, 3, 2, 1])
  })
  it('clamps out-of-range y to degrees 7 and 1', () => {
    expect(mandalLeverFromY(-1)).toBe(7)
    expect(mandalLeverFromY(2)).toBe(1)
  })
})

describe('createMandalGesture — vertical flick', () => {
  const open = 0.12
  it('emits a RAISE (+1) on a fast upward flick, tagged with the lever degree', () => {
    const g = createMandalGesture()
    // Finger inside the degree-3 band (y∈[0.571,0.714)), flicking up fast.
    expect(g.update({ x: 0.05, y: 0.68, pinchDist: open, tNow: 0 })).toBeNull()
    const ev = g.update({ x: 0.05, y: 0.60, pinchDist: open, tNow: 0.04 })
    expect(ev).toEqual({ degree: 3, direction: 1 })
  })

  it('emits a LOWER (−1) on a fast downward flick', () => {
    const g = createMandalGesture()
    // Finger inside the degree-4 band (y∈[0.429,0.571)), flicking down fast.
    g.update({ x: 0.05, y: 0.48, pinchDist: open, tNow: 0 })
    const ev = g.update({ x: 0.05, y: 0.56, pinchDist: open, tNow: 0.04 })
    expect(ev).toEqual({ degree: 4, direction: -1 })
  })

  it('ignores slow vertical drift (repositioning between levers)', () => {
    const g = createMandalGesture()
    g.update({ x: 0.05, y: 0.5, pinchDist: open, tNow: 0 })
    expect(g.update({ x: 0.05, y: 0.42, pinchDist: open, tNow: 0.8 })).toBeNull()
  })

  it('debounces — one flick does not retrigger until motion settles', () => {
    const g = createMandalGesture()
    g.update({ x: 0.05, y: 0.68, pinchDist: open, tNow: 0 })
    expect(g.update({ x: 0.05, y: 0.60, pinchDist: open, tNow: 0.04 })).not.toBeNull()
    // Still coasting upward fast — must not fire a second time immediately.
    expect(g.update({ x: 0.05, y: 0.52, pinchDist: open, tNow: 0.08 })).toBeNull()
  })

  it('pinch-to-cycle fallback: a pinch onset on a lever raises it (+1)', () => {
    const g = createMandalGesture()
    g.update({ x: 0.05, y: 0.21, pinchDist: 0.12, tNow: 0 }) // open on degree-6 band
    const ev = g.update({ x: 0.05, y: 0.21, pinchDist: 0.02, tNow: 0.05 })
    expect(ev).toEqual({ degree: 6, direction: 1 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/gesture/detectMandal.test.ts`
Expected: FAIL — `Cannot find module './detectMandal'`.

- [ ] **Step 3: Write the implementation**

`src/lib/gesture/detectMandal.ts`:
```ts
import { DEGREE_COUNT } from '../music/ajnas/MANDALS'

// The mandal zone is the far-left strip where the real mandals sit. x is a
// normalized screen coordinate (0 = screen-left), already mirrored.
export const MANDAL_ZONE_RIGHT = 0.18

export const isInMandalZone = (x: number, zoneRight = MANDAL_ZONE_RIGHT): boolean =>
  x <= zoneRight

// Which lever the fingertip is on. y is 0 at the top of frame, 1 at the bottom.
// Top band = highest degree (7), bottom band = degree 1.
export const mandalLeverFromY = (y: number, degreeCount = DEGREE_COUNT): number => {
  const clamped = Math.min(0.999999, Math.max(0, y))
  const band = Math.floor(clamped * degreeCount) // 0 (top) .. degreeCount-1 (bottom)
  return degreeCount - band
}

export interface MandalEvent {
  degree: number
  direction: 1 | -1
}

export interface MandalGestureOptions {
  flickSpeed?: number     // |dy|/dt (units/sec) to count as a flick
  settleSpeed?: number    // |dy|/dt below which the gesture re-arms
  pinchClose?: number     // pinch distance for the cycle fallback
  pinchOpen?: number       // re-arm threshold for the pinch fallback
}

export interface MandalGesture {
  update: (args: { x: number; y: number; pinchDist: number; tNow: number }) => MandalEvent | null
  reset: () => void
}

// Vertical flick (sign of y-velocity) raises/lowers the lever under the
// fingertip; pinch-to-cycle is a reliable fallback. Both debounce until motion
// settles / the pinch re-opens.
export const createMandalGesture = ({
  flickSpeed = 1.5,
  settleSpeed = 0.6,
  pinchClose = 0.05,
  pinchOpen = 0.07
}: MandalGestureOptions = {}): MandalGesture => {
  let prevY: number | null = null
  let prevT: number | null = null
  let armed = true
  let pinchClosed = false

  const update = ({
    x: _x,
    y,
    pinchDist,
    tNow
  }: {
    x: number
    y: number
    pinchDist: number
    tNow: number
  }): MandalEvent | null => {
    const degree = mandalLeverFromY(y)
    let event: MandalEvent | null = null

    // Pinch-to-cycle fallback (onset edge → raise).
    if (!pinchClosed && pinchDist < pinchClose) {
      pinchClosed = true
      event = { degree, direction: 1 }
    } else if (pinchClosed && pinchDist > pinchOpen) {
      pinchClosed = false
    }

    // Vertical flick.
    if (!event && prevY !== null && prevT !== null) {
      const dt = Math.max(1e-3, tNow - prevT)
      const vy = (y - prevY) / dt // negative = upward
      const speed = Math.abs(vy)
      if (armed && speed >= flickSpeed) {
        event = { degree, direction: vy < 0 ? 1 : -1 }
        armed = false
      } else if (!armed && speed <= settleSpeed) {
        armed = true
      }
    }

    prevY = y
    prevT = tNow
    return event
  }

  const reset = (): void => {
    prevY = null
    prevT = null
    armed = true
    pinchClosed = false
  }

  return { update, reset }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/gesture/detectMandal.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gesture/detectMandal.ts src/lib/gesture/detectMandal.test.ts
git commit -m "feat: detectMandal — zone test, lever-from-y, vertical flick + pinch-cycle"
```

---

## Task 13: Audio pure helpers (velocity curve + voice pool)

**Files:**
- Create: `src/lib/audio/velocityCurve.ts`, `src/lib/audio/voicePool.ts`
- Test: `src/lib/audio/velocityCurve.test.ts`, `src/lib/audio/voicePool.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/audio/velocityCurve.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { velocityCurve } from './velocityCurve'

describe('velocityCurve', () => {
  it('maps 0 → min and 1 → max', () => {
    expect(velocityCurve(0)).toBeCloseTo(0.15, 6)        // default floor
    expect(velocityCurve(1)).toBeCloseTo(1, 6)
  })
  it('is monotonic increasing', () => {
    let prev = -1
    for (let s = 0; s <= 1.0001; s += 0.1) {
      const v = velocityCurve(s)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('clamps out-of-range speed', () => {
    expect(velocityCurve(-5)).toBeCloseTo(0.15, 6)
    expect(velocityCurve(5)).toBeCloseTo(1, 6)
  })
  it('respects custom min/max/gamma', () => {
    expect(velocityCurve(0, { min: 0.3, max: 0.9 })).toBeCloseTo(0.3, 6)
    expect(velocityCurve(1, { min: 0.3, max: 0.9 })).toBeCloseTo(0.9, 6)
  })
})
```

`src/lib/audio/voicePool.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { nextVoiceIndex } from './voicePool'

describe('nextVoiceIndex — round-robin', () => {
  it('advances and wraps', () => {
    expect(nextVoiceIndex(0, 4)).toBe(1)
    expect(nextVoiceIndex(3, 4)).toBe(0)
  })
  it('handles a pool of one', () => {
    expect(nextVoiceIndex(0, 1)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/audio/velocityCurve.test.ts src/lib/audio/voicePool.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

`src/lib/audio/velocityCurve.ts`:
```ts
export interface VelocityCurveOptions {
  min?: number   // floor so even the gentlest pluck is audible
  max?: number
  gamma?: number // >1 makes soft plucks softer (perceptual shaping)
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

// Map a normalized gesture speed (0..1) to a pluck velocity (min..max).
export const velocityCurve = (
  speed: number,
  { min = 0.15, max = 1, gamma = 1.5 }: VelocityCurveOptions = {}
): number => {
  const shaped = Math.pow(clamp01(speed), gamma)
  return min + (max - min) * shaped
}
```

`src/lib/audio/voicePool.ts`:
```ts
// Round-robin index into a fixed pool of synth voices (voice stealing).
export const nextVoiceIndex = (current: number, size: number): number =>
  (current + 1) % size
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/audio/velocityCurve.test.ts src/lib/audio/voicePool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/velocityCurve.ts src/lib/audio/velocityCurve.test.ts src/lib/audio/voicePool.ts src/lib/audio/voicePool.test.ts
git commit -m "feat: audio pure helpers — velocity curve + round-robin voice index"
```

---

## Task 14: createQanunEngine (PluckSynth pool + reverb)

Mirrors theremin's factory shape and its **injectable-`Tone`** test pattern (see `../theremin/src/lib/practice/createDrone.ts`). P1 ships the Karplus-Strong synth voice; the `Tone.Sampler` source is P2 behind the same `pluck()` interface.

**Files:**
- Create: `src/lib/audio/createQanunEngine.ts`
- Test: `src/lib/audio/createQanunEngine.test.ts`

- [ ] **Step 1: Write the failing test (mocking Tone like createDrone.test.ts)**

`src/lib/audio/createQanunEngine.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createQanunEngine } from './createQanunEngine'

const makeMockTone = () => {
  const triggerAttack = vi.fn()
  const voiceGainRampTo = vi.fn()
  const reverbWetRampTo = vi.fn()
  const ToneMock = {
    start: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn(() => ({ sampleRate: 48000 })),
    PluckSynth: vi.fn().mockImplementation(() => ({
      triggerAttack,
      connect: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    })),
    Gain: vi.fn().mockImplementation((v: number) => ({
      gain: { value: v, rampTo: voiceGainRampTo },
      connect: vi.fn().mockReturnThis(),
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    })),
    Reverb: vi.fn().mockImplementation(() => ({
      wet: { value: 0, rampTo: reverbWetRampTo },
      decay: 0,
      preDelay: 0,
      connect: vi.fn().mockReturnThis(),
      dispose: vi.fn()
    }))
  }
  return { ToneMock, triggerAttack, voiceGainRampTo, reverbWetRampTo }
}

const ENGINE_ARGS = (ToneMock: unknown) => ({
  Tone: ToneMock as unknown as typeof import('tone'),
  polyphony: 4
})

describe('createQanunEngine', () => {
  it('exposes the documented surface', () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (const fn of ['start', 'dispose', 'pluck', 'setReverbEnabled', 'setReverbWet', 'setReverbSize', 'getSampleRate']) {
      expect(typeof (e as unknown as Record<string, unknown>)[fn]).toBe('function')
    }
    expect(e.isStarted).toBe(false)
  })

  it('builds a pool of `polyphony` PluckSynth voices', () => {
    const { ToneMock } = makeMockTone()
    createQanunEngine(ENGINE_ARGS(ToneMock))
    expect(ToneMock.PluckSynth).toHaveBeenCalledTimes(4)
  })

  it('pluck() triggers a voice at the given frequency and sets its gain from velocity', () => {
    const { ToneMock, triggerAttack, voiceGainRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.pluck({ freqHz: 261.63, velocity: 0.8 })
    expect(triggerAttack).toHaveBeenCalledTimes(1)
    // Frequency in Hz passed as the first arg (quarter-tones come free).
    expect(triggerAttack.mock.calls[0][0]).toBeCloseTo(261.63, 2)
    // A per-voice gain ramp was driven toward the velocity.
    const lastGain = voiceGainRampTo.mock.calls.at(-1)?.[0]
    expect(lastGain).toBeGreaterThan(0)
  })

  it('round-robins voices across successive plucks', () => {
    const { ToneMock, triggerAttack } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    for (let i = 0; i < 5; i++) e.pluck({ freqHz: 200 + i, velocity: 0.5 })
    expect(triggerAttack).toHaveBeenCalledTimes(5) // 4-voice pool reused on the 5th
  })

  it('setReverbEnabled(false) forces wet → 0', () => {
    const { ToneMock, reverbWetRampTo } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    e.setReverbWet(0.6)
    e.setReverbEnabled(false)
    expect(reverbWetRampTo.mock.calls.at(-1)?.[0]).toBe(0)
  })

  it('start() unlocks the audio context once', async () => {
    const { ToneMock } = makeMockTone()
    const e = createQanunEngine(ENGINE_ARGS(ToneMock))
    await e.start()
    expect(ToneMock.start).toHaveBeenCalledTimes(1)
    expect(e.isStarted).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/audio/createQanunEngine.test.ts`
Expected: FAIL — `Cannot find module './createQanunEngine'`.

- [ ] **Step 3: Write the implementation**

`src/lib/audio/createQanunEngine.ts`:
```ts
import * as ToneNamespace from 'tone'
import type { Gain, ToneAudioNode } from 'tone'
import type { ReverbSize } from '../../types'
import { reverbSizeToParams } from './reverbSize'
import { velocityCurve } from './velocityCurve'
import { nextVoiceIndex } from './voicePool'

// Per-course plucked-string engine. P1 voice = Tone.PluckSynth (Karplus-Strong);
// P2 swaps in a Tone.Sampler behind this same `pluck()` interface. A pool of
// monophonic voices gives polyphony for chords + fast runs (voice stealing).
export interface QanunEngineOptions {
  Tone?: typeof ToneNamespace // injectable for tests (see createDrone.ts)
  polyphony?: number
  fx?: Partial<{ reverbEnabled: boolean; reverbWet: number; reverbSize: ReverbSize }>
}

export interface QanunEngine {
  start: () => Promise<void>
  dispose: () => void
  pluck: (args: { freqHz: number; velocity: number; time?: number }) => void
  setReverbEnabled: (enabled: boolean) => void
  setReverbWet: (wet: number) => void
  setReverbSize: (size: ReverbSize) => void
  getSampleRate: () => number
  readonly sumBus: Gain
  readonly isStarted: boolean
}

const FX_WET_RAMP = 0.08
const VOICE_GAIN_RAMP = 0.01
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

export const createQanunEngine = ({
  Tone = ToneNamespace,
  polyphony = 16,
  fx
}: QanunEngineOptions = {}): QanunEngine => {
  let reverbEnabled = fx?.reverbEnabled ?? true
  let reverbWet = fx?.reverbWet ?? 0.3
  let reverbSize: ReverbSize = fx?.reverbSize ?? 'medium'

  // Chain: voice[i] → voiceGain[i] → reverb → sumBus → destination.
  const sumBus = new Tone.Gain(1).toDestination()
  const params = reverbSizeToParams(reverbSize)
  const reverb = new Tone.Reverb({
    decay: params.decaySec,
    preDelay: params.preDelaySec,
    wet: reverbEnabled ? clamp01(reverbWet) : 0
  })
  reverb.connect(sumBus)

  const voices = Array.from({ length: polyphony }, () => {
    const g = new Tone.Gain(0)
    g.connect(reverb)
    const synth = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.9 })
    synth.connect(g)
    return { synth, gain: g }
  })

  let voiceIndex = -1
  let started = false

  const start = async (): Promise<void> => {
    if (started) return
    await Tone.start()
    started = true
  }

  const pluck = ({
    freqHz,
    velocity,
    time
  }: {
    freqHz: number
    velocity: number
    time?: number
  }): void => {
    if (!Number.isFinite(freqHz) || freqHz <= 0) return
    voiceIndex = nextVoiceIndex(voiceIndex < 0 ? voices.length - 1 : voiceIndex, voices.length)
    const v = voices[voiceIndex]
    v.gain.gain.rampTo(velocityCurve(clamp01(velocity)), VOICE_GAIN_RAMP)
    // PluckSynth accepts a frequency in Hz as the note — quarter-tones come free.
    v.synth.triggerAttack(freqHz, time)
  }

  const applyReverbWet = (): void => {
    reverb.wet.rampTo(reverbEnabled ? clamp01(reverbWet) : 0, FX_WET_RAMP)
  }
  const setReverbEnabled = (enabled: boolean): void => {
    reverbEnabled = enabled
    applyReverbWet()
  }
  const setReverbWet = (wet: number): void => {
    reverbWet = clamp01(wet)
    applyReverbWet()
  }
  const setReverbSize = (size: ReverbSize): void => {
    reverbSize = size
    const p = reverbSizeToParams(size)
    reverb.decay = p.decaySec
    reverb.preDelay = p.preDelaySec
  }

  const dispose = (): void => {
    voices.forEach((v) => {
      v.synth.dispose()
      v.gain.dispose()
    })
    reverb.dispose()
    sumBus.dispose()
  }

  const getSampleRate = (): number => Tone.getContext().sampleRate

  return {
    start,
    dispose,
    pluck,
    setReverbEnabled,
    setReverbWet,
    setReverbSize,
    getSampleRate,
    get sumBus() {
      return sumBus as unknown as Gain
    },
    get isStarted() {
      return started
    }
  }
}

// Re-export for callers that attach practice/recorder taps later (P4).
export type { ToneAudioNode }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/audio/createQanunEngine.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Run the whole suite — the pure core is complete and green**

Run: `npm run test:run`
Expected: every suite from Tasks 1–14 passes (music model, gesture math, audio). This is the TDD heart of the instrument.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio/createQanunEngine.ts src/lib/audio/createQanunEngine.test.ts
git commit -m "feat: createQanunEngine — PluckSynth voice pool + reverb (sound-source agnostic)"
```

---

## Task 15: App shell — Stage, StageCover, types, start/permission

**Files:**
- Modify: `src/types.ts` (add app-level types)
- Create: `src/components/Stage.tsx`, `src/components/StageCover.tsx`, `src/components/TypedSelect.tsx`
- Test: `src/components/StageCover.test.tsx`

- [ ] **Step 1: Extend `src/types.ts` with app-level types**

Add to `src/types.ts` (below the existing `NormPoint` / `ReverbSize`):
```ts
export type QanunStatus = 'idle' | 'loading' | 'running' | 'error'

export type RakeSensitivity = 'off' | 'subtle' | 'full'

// Live readout pushed to the HUD a few times a second.
export interface QanunReading {
  maqamName: string
  lowerJins: string | null
  upperJins: string | null
  tonicMidi: number
  lastPluckMidi: number | null
}
```

- [ ] **Step 2: Copy TypedSelect and adapt Stage from theremin**

```bash
cd /Users/yusuf/Projects/qanun
cp ../theremin/src/components/TypedSelect.tsx src/components/TypedSelect.tsx
```

`src/components/Stage.tsx` (the camera + overlay canvas + optional cover; `QanunStatus`):
```tsx
import type { RefObject, ReactNode } from 'react'
import type { QanunStatus } from '../types'
import { VIDEO_HEIGHT, VIDEO_WIDTH } from '../lib/vision/constants'

interface StageProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  status: QanunStatus
  cover?: ReactNode
}

export const Stage = ({ videoRef, canvasRef, status, cover }: StageProps) => (
  <div className={`stage status-${status}`}>
    <video ref={videoRef} className="video" playsInline muted width={VIDEO_WIDTH} height={VIDEO_HEIGHT} />
    <canvas ref={canvasRef} className="overlay" />
    {cover}
  </div>
)
```

- [ ] **Step 3: Write a failing test for the start/permission cover**

`src/components/StageCover.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StageCover } from './StageCover'

describe('StageCover (start / permission flow)', () => {
  it('shows a start button when idle and calls onStart', async () => {
    const onStart = vi.fn()
    render(<StageCover status="idle" errorMsg={null} onStart={onStart} />)
    const btn = screen.getByRole('button', { name: /play/i })
    btn.click()
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('renders nothing while running', () => {
    const { container } = render(<StageCover status="running" errorMsg={null} onStart={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the error message and a retry button on error', () => {
    render(<StageCover status="error" errorMsg="camera blocked" onStart={() => {}} />)
    expect(screen.getByText(/camera blocked/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy()
  })
})
```

This needs Testing Library. Add the devDeps and enable the matchers:

Run: `npm i -D @testing-library/react @testing-library/jest-dom @testing-library/dom`

Update `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run src/components/StageCover.test.tsx`
Expected: FAIL — `Cannot find module './StageCover'`.

- [ ] **Step 5: Write StageCover**

`src/components/StageCover.tsx`:
```tsx
import type { QanunStatus } from '../types'

interface StageCoverProps {
  status: QanunStatus
  errorMsg: string | null
  onStart: () => void
}

// Zero-config entry: a single "play" affordance. Tone.js + camera both require
// a user gesture, so the first tap unlocks audio and requests the webcam.
export const StageCover = ({ status, errorMsg, onStart }: StageCoverProps) => {
  if (status === 'running') return null
  return (
    <div className="stage-cover">
      {status === 'loading' && <span className="spinner">loading…</span>}
      {status === 'error' && (
        <div className="error">
          <strong>couldn’t start</strong>
          <span>{errorMsg}</span>
        </div>
      )}
      {(status === 'idle' || status === 'error') && (
        <button className="primary" onClick={onStart}>
          play
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run src/components/StageCover.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/components/Stage.tsx src/components/StageCover.tsx src/components/TypedSelect.tsx src/components/StageCover.test.tsx src/test-setup.ts package.json package-lock.json
git commit -m "feat: app shell — Stage, StageCover start/permission flow, app types"
```

---

## Task 16: useQanunEngine — the frame loop

The hook wires detect → hand-role → gesture → audio + state, mirroring `useThereminEngine`'s structure (refs for hot state, `scheduleVideoFrame` loop, lazy engine build in `start()`). The role-assignment decision is extracted to a pure, tested helper; the rest is wiring verified by running the app (Task 21).

**Files:**
- Create: `src/hooks/deriveHandRoles.ts`
- Test: `src/hooks/deriveHandRoles.test.ts`
- Create: `src/hooks/useQanunEngine.ts`

- [ ] **Step 1: Write the failing test for the role helper**

`src/hooks/deriveHandRoles.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { deriveHandRoles } from './deriveHandRoles'

// Right hand plays only; left hand plays AND modulates (when in the mandal zone).
describe('deriveHandRoles', () => {
  it('assigns the right hand to play, the left to play', () => {
    const roles = deriveHandRoles({ rightHandIdx: 0, leftHandIdx: 1, leftHandX: 0.5 })
    expect(roles.playHands).toEqual([0, 1])
    expect(roles.mandalHandIdx).toBeNull()
  })

  it('routes the left hand to mandal mode when it is in the zone', () => {
    const roles = deriveHandRoles({ rightHandIdx: 0, leftHandIdx: 1, leftHandX: 0.05 })
    expect(roles.mandalHandIdx).toBe(1)
    expect(roles.playHands).toEqual([0]) // left hand no longer plays while modulating
  })

  it('handles a missing hand (idx -1)', () => {
    const roles = deriveHandRoles({ rightHandIdx: -1, leftHandIdx: 1, leftHandX: 0.5 })
    expect(roles.playHands).toEqual([1])
    expect(roles.mandalHandIdx).toBeNull()
  })

  it('no left hand → no mandal control', () => {
    const roles = deriveHandRoles({ rightHandIdx: 0, leftHandIdx: -1, leftHandX: 0.05 })
    expect(roles.mandalHandIdx).toBeNull()
    expect(roles.playHands).toEqual([0])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/deriveHandRoles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write deriveHandRoles**

`src/hooks/deriveHandRoles.ts`:
```ts
import { isInMandalZone } from '../lib/gesture/detectMandal'

export interface HandRolesArgs {
  rightHandIdx: number  // -1 if absent
  leftHandIdx: number   // -1 if absent
  leftHandX: number     // mirrored screen x of the left hand's index tip
}

export interface HandRoles {
  playHands: number[]        // landmark indices that pluck this frame
  mandalHandIdx: number | null // landmark index controlling the mandal rack, or null
}

// Right hand plays only. Left hand plays — unless it's in the mandal zone, in
// which case it switches to modulating and stops plucking (clear separation,
// mirrors the real instrument's geography).
export const deriveHandRoles = ({ rightHandIdx, leftHandIdx, leftHandX }: HandRolesArgs): HandRoles => {
  const playHands: number[] = []
  if (rightHandIdx !== -1) playHands.push(rightHandIdx)

  let mandalHandIdx: number | null = null
  if (leftHandIdx !== -1) {
    if (isInMandalZone(leftHandX)) {
      mandalHandIdx = leftHandIdx
    } else {
      playHands.push(leftHandIdx)
    }
  }
  return { playHands, mandalHandIdx }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/hooks/deriveHandRoles.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the hook (wiring)**

`src/hooks/useQanunEngine.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { MandalState, Course } from '../lib/music/types'
import type { QanunReading, QanunStatus, RakeSensitivity } from '../types'
import { DEFAULT_RAST_STATE, cycleMandal } from '../lib/music/ajnas/MANDALS'
import { buildField, DEFAULT_TONIC_MIDI } from '../lib/music/buildField'
import { identifyAjnas } from '../lib/music/identifyAjnas'
import { applyJinsPair, type JinsPair } from '../lib/music/sayr/jinsPairs'
import { nearestCourse, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT } from '../lib/gesture/nearestCourse'
import { createPluckDetector } from '../lib/gesture/detectPluck'
import { createRakeDetector } from '../lib/gesture/detectRake'
import { createMandalGesture } from '../lib/gesture/detectMandal'
import { createQanunEngine, type QanunEngine } from '../lib/audio/createQanunEngine'
import { velocityCurve } from '../lib/audio/velocityCurve'
import { createOneEuroFilter } from '../lib/oneEuro/createOneEuroFilter'
import { findHandedness } from '../lib/vision/findHandedness'
import { loadHandLandmarker } from '../lib/vision/loadHandLandmarker'
import { pinchDistance } from '../lib/vision/pinchDistance'
import { scheduleVideoFrame, type FrameHandle } from '../lib/vision/scheduleVideoFrame'
import { startCamera } from '../lib/vision/startCamera'
import { stopCamera } from '../lib/vision/stopCamera'
import { INDEX_TIP, THUMB_TIP } from '../lib/vision/constants'
import { deriveHandRoles } from './deriveHandRoles'

const READING_PUSH_EVERY_N_FRAMES = 4

export interface UseQanunEngineArgs {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export interface UseQanunEngine {
  status: QanunStatus
  errorMsg: string | null
  reading: QanunReading
  courses: Course[]
  mandalState: MandalState
  tonicMidi: number
  rakeSensitivity: RakeSensitivity
  start: () => Promise<void>
  stop: () => void
  setTonic: (midi: number) => void
  setRakeSensitivity: (s: RakeSensitivity) => void
  cycleMandalDegree: (degree: number, direction: 1 | -1) => void
  applyPair: (pair: JinsPair) => void
}

const EMPTY_READING: QanunReading = {
  maqamName: 'Maqam Rast',
  lowerJins: 'rast',
  upperJins: 'rast',
  tonicMidi: DEFAULT_TONIC_MIDI,
  lastPluckMidi: null
}

export const useQanunEngine = ({ videoRef, canvasRef }: UseQanunEngineArgs): UseQanunEngine => {
  const [status, setStatus] = useState<QanunStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reading, setReading] = useState<QanunReading>(EMPTY_READING)
  const [tonicMidi, setTonicMidi] = useState(DEFAULT_TONIC_MIDI)
  const [mandalState, setMandalState] = useState<MandalState>(DEFAULT_RAST_STATE)
  const [rakeSensitivity, setRakeSensitivityState] = useState<RakeSensitivity>('subtle')
  const [courses, setCourses] = useState<Course[]>(() =>
    buildField({ tonicMidi: DEFAULT_TONIC_MIDI, mandalState: DEFAULT_RAST_STATE })
  )

  // Hot refs (read inside the frame loop without re-subscribing).
  const tonicRef = useRef(DEFAULT_TONIC_MIDI)
  const mandalRef = useRef<MandalState>(DEFAULT_RAST_STATE)
  const coursesRef = useRef<Course[]>(courses)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const audioRef = useRef<QanunEngine | null>(null)
  const frameHandleRef = useRef<FrameHandle | null>(null)
  const runningRef = useRef(false)
  const frameCounterRef = useRef(0)

  // One detector set per role. Two playing hands → two pluck/rake detectors.
  const pluckDetectorsRef = useRef([createPluckDetector(), createPluckDetector()])
  const rakeDetectorsRef = useRef([
    createRakeDetector({ sensitivity: 'subtle' }),
    createRakeDetector({ sensitivity: 'subtle' })
  ])
  const mandalGestureRef = useRef(createMandalGesture())
  const fingerFiltersRef = useRef([createOneEuroFilter({ minCutoff: 1.2, beta: 0.02 }), createOneEuroFilter({ minCutoff: 1.2, beta: 0.02 })])

  const recompute = useCallback((next: MandalState, nextTonic: number): void => {
    const field = buildField({ tonicMidi: nextTonic, mandalState: next })
    coursesRef.current = field
    setCourses(field)
    const id = identifyAjnas(next)
    setReading((r) => ({ ...r, maqamName: id.maqamName, lowerJins: id.lower, upperJins: id.upper, tonicMidi: nextTonic }))
  }, [])

  const setMandalAll = useCallback((next: MandalState): void => {
    mandalRef.current = next
    setMandalState(next)
    recompute(next, tonicRef.current)
  }, [recompute])

  const cycleMandalDegree = useCallback((degree: number, direction: 1 | -1): void => {
    setMandalAll(cycleMandal(mandalRef.current, degree, direction))
  }, [setMandalAll])

  const applyPair = useCallback((pair: JinsPair): void => {
    setMandalAll(applyJinsPair(mandalRef.current, pair))
  }, [setMandalAll])

  const setTonic = useCallback((midi: number): void => {
    tonicRef.current = midi
    setTonicMidi(midi)
    recompute(mandalRef.current, midi)
  }, [recompute])

  const setRakeSensitivity = useCallback((s: RakeSensitivity): void => {
    setRakeSensitivityState(s)
    rakeDetectorsRef.current.forEach((d) => d.setSensitivity(s))
  }, [])

  const tick = useCallback((): void => {
    if (!runningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    const audio = audioRef.current
    const scheduleNext = (): void => {
      if (!runningRef.current || !video) return
      frameHandleRef.current = scheduleVideoFrame({ video, callback: tick })
    }
    if (!video || !canvas || !landmarker || !audio || video.readyState < 2) {
      scheduleNext()
      return
    }

    let result
    try {
      result = landmarker.detectForVideo(video, performance.now())
    } catch {
      scheduleNext()
      return
    }

    const tNow = performance.now() / 1000
    const { rightHandIdx, leftHandIdx } = findHandedness({ result })
    // Mirror x to screen space (0 = screen-left). Left hand's index tip x.
    const leftHandX = leftHandIdx !== -1 ? 1 - result.landmarks[leftHandIdx][INDEX_TIP].x : 1
    const { playHands, mandalHandIdx } = deriveHandRoles({ rightHandIdx, leftHandIdx, leftHandX })
    const field = coursesRef.current

    // --- Mandal hand ---
    if (mandalHandIdx !== null) {
      const lm = result.landmarks[mandalHandIdx]
      const tip = lm[INDEX_TIP]
      const ev = mandalGestureRef.current.update({
        x: 1 - tip.x,
        y: tip.y,
        pinchDist: pinchDistance({ a: tip, b: lm[THUMB_TIP] }),
        tNow
      })
      if (ev) setMandalAll(cycleMandal(mandalRef.current, ev.degree, ev.direction))
    } else {
      mandalGestureRef.current.reset()
    }

    // --- Playing hands ---
    let lastPluckMidi: number | null = null
    playHands.forEach((handIdx, slot) => {
      if (slot > 1) return // two-slot pool
      const lm = result.landmarks[handIdx]
      const tip = lm[INDEX_TIP]
      const screenX = fingerFiltersRef.current[slot].filter({ x: 1 - tip.x, tNow })
      const course = nearestCourse({
        x: screenX,
        courseCount: field.length,
        fieldLeft: PLAY_FIELD_LEFT,
        fieldRight: PLAY_FIELD_RIGHT
      })
      // Pinch pluck (precise).
      const pluck = pluckDetectorsRef.current[slot].update({
        pinchDist: pinchDistance({ a: tip, b: lm[THUMB_TIP] }),
        courseIndex: course,
        tNow
      })
      if (pluck && field[pluck.courseIndex]) {
        audio.pluck({ freqHz: field[pluck.courseIndex].freqHz, velocity: pluck.velocity })
        lastPluckMidi = field[pluck.courseIndex].midi
      }
      // Rake (glissando).
      const raked = rakeDetectorsRef.current[slot].update({ courseIndex: course, tNow })
      for (const c of raked) {
        if (field[c]) {
          audio.pluck({ freqHz: field[c].freqHz, velocity: velocityCurve(0.7) })
          lastPluckMidi = field[c].midi
        }
      }
    })

    frameCounterRef.current += 1
    if (lastPluckMidi !== null || frameCounterRef.current % READING_PUSH_EVERY_N_FRAMES === 0) {
      setReading((r) => ({ ...r, lastPluckMidi: lastPluckMidi ?? r.lastPluckMidi }))
    }

    // Overlay drawing (finger rings) is added in Task 21's integration pass,
    // reusing lib/draw — kept out of the audio path so it never blocks a pluck.
    scheduleNext()
  }, [videoRef, canvasRef, setMandalAll])

  const start = useCallback(async (): Promise<void> => {
    if (status === 'running' || status === 'loading') return
    setErrorMsg(null)
    setStatus('loading')
    try {
      if (!audioRef.current) audioRef.current = createQanunEngine({ polyphony: 16 })
      await audioRef.current.start()
      if (!landmarkerRef.current) landmarkerRef.current = await loadHandLandmarker()
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) throw new Error('Video/canvas element missing')
      const { width, height } = await startCamera({ video })
      canvas.width = width
      canvas.height = height
      pluckDetectorsRef.current.forEach((d) => d.reset())
      rakeDetectorsRef.current.forEach((d) => d.reset())
      mandalGestureRef.current.reset()
      fingerFiltersRef.current.forEach((f) => f.reset())
      frameCounterRef.current = 0
      runningRef.current = true
      setStatus('running')
      frameHandleRef.current = scheduleVideoFrame({ video, callback: tick })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [status, videoRef, canvasRef, tick])

  const stop = useCallback((): void => {
    runningRef.current = false
    frameHandleRef.current?.cancel()
    frameHandleRef.current = null
    stopCamera({ video: videoRef.current })
    setStatus('idle')
  }, [videoRef])

  useEffect(() => () => audioRef.current?.dispose(), [])

  return {
    status,
    errorMsg,
    reading,
    courses,
    mandalState,
    tonicMidi,
    rakeSensitivity,
    start,
    stop,
    setTonic,
    setRakeSensitivity,
    cycleMandalDegree,
    applyPair
  }
}
```

- [ ] **Step 6: Verify the hook typechecks (no behavioral test — exercised in Task 21)**

Run: `npx tsc -b`
Expected: no type errors.

Run: `npm run test:run`
Expected: all suites pass (the new `deriveHandRoles` suite included).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/deriveHandRoles.ts src/hooks/deriveHandRoles.test.ts src/hooks/useQanunEngine.ts
git commit -m "feat: useQanunEngine frame loop + tested hand-role derivation"
```

---

## Task 17: StringField component

> **Invoke the frontend-design skill** for this and Tasks 18–21. The plan pins the component *contract* (props, data, structure); frontend-design owns the photoreal treatment (warm wood soundboard, brass strings, glow, pluck feedback). Strings are vertical; pitch runs low→high left→right (spec §7).

**Files:**
- Create: `src/components/StringField.tsx`

- [ ] **Step 1: Implement a functional StringField bound to the course data**

`src/components/StringField.tsx`:
```tsx
import type { Course } from '../lib/music/types'
import { PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT, courseScreenX } from '../lib/gesture/nearestCourse'

interface StringFieldProps {
  courses: Course[]
  highlightIndex: number | null   // nearest course under a playing finger
  pluckedIndex: number | null     // course that just sounded (for feedback)
}

// Vertical brass strings across the play field. Each course is positioned at
// its screen x (matching nearestCourse, so visuals and hit-testing agree).
export const StringField = ({ courses, highlightIndex, pluckedIndex }: StringFieldProps) => (
  <div className="string-field" aria-hidden>
    {courses.map((c) => {
      const xPct = courseScreenX(c.index, courses.length, PLAY_FIELD_LEFT, PLAY_FIELD_RIGHT) * 100
      const classes = [
        'string',
        `degree-${c.degree}`,
        c.degree === 1 ? 'is-tonic' : '',
        c.index === highlightIndex ? 'is-highlight' : '',
        c.index === pluckedIndex ? 'is-plucked' : ''
      ].filter(Boolean).join(' ')
      return <span key={c.index} className={classes} style={{ left: `${xPct}%` }} data-degree={c.degree} />
    })}
  </div>
)
```

- [ ] **Step 2: frontend-design pass + verification**

Invoke **frontend-design** to style `.string-field` / `.string` (string thickness by register, brass gradient, tonic-course accent, highlight glow, a brief pluck pulse via a CSS animation on `.is-plucked`). Keep the contract above unchanged.

Run: `npx tsc -b` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StringField.tsx src/App.css src/index.css
git commit -m "feat: StringField — vertical brass strings bound to the course field"
```

---

## Task 18: MandalRack component

**Files:**
- Create: `src/components/MandalRack.tsx`

- [ ] **Step 1: Implement the 7-lever rack bound to mandal state**

`src/components/MandalRack.tsx`:
```tsx
import type { MandalState } from '../lib/music/types'
import { MANDAL_DEGREES, offsetOf } from '../lib/music/ajnas/MANDALS'

interface MandalRackProps {
  mandalState: MandalState
  activeDegree: number | null                     // lever under the left hand
  onCycle: (degree: number, direction: 1 | -1) => void
}

// Seven stacked levers (degree 7 at the top → degree 1 at the bottom, matching
// mandalLeverFromY). Each shows its current position within the degree's set.
// Click affordances mirror the flick gesture so the rack is usable without a camera.
export const MandalRack = ({ mandalState, activeDegree, onCycle }: MandalRackProps) => (
  <div className="mandal-rack">
    {[...MANDAL_DEGREES].reverse().map((md) => {
      const current = offsetOf(mandalState, md.degree)
      const posIndex = md.positions.indexOf(current)
      return (
        <div
          key={md.degree}
          className={`lever degree-${md.degree} ${activeDegree === md.degree ? 'is-active' : ''} ${md.fixed ? 'is-fixed' : ''}`}
        >
          <button className="up" disabled={md.fixed} onClick={() => onCycle(md.degree, 1)} aria-label={`raise degree ${md.degree}`}>▲</button>
          <span className="pos" data-degree={md.degree}>
            {md.positions.map((p, i) => (
              <span key={p} className={`tick ${i === posIndex ? 'on' : ''}`} />
            ))}
          </span>
          <button className="down" disabled={md.fixed} onClick={() => onCycle(md.degree, -1)} aria-label={`lower degree ${md.degree}`}>▼</button>
        </div>
      )
    })}
  </div>
)
```

- [ ] **Step 2: frontend-design pass + verification**

Invoke **frontend-design** for the rack's photoreal treatment (brass levers seated in wood, the active lever lit, a flip animation on position change). Contract unchanged.

Run: `npx tsc -b` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MandalRack.tsx src/App.css
git commit -m "feat: MandalRack — 7 levers bound to mandal state with cycle controls"
```

---

## Task 19: QanunHud + CameraInset

**Files:**
- Create: `src/components/QanunHud.tsx`, `src/components/CameraInset.tsx`

- [ ] **Step 1: Implement the live readout (HUD)**

`src/components/QanunHud.tsx`:
```tsx
import type { QanunReading } from '../types'
import { midiName } from '../lib/music/midiName'

interface QanunHudProps {
  reading: QanunReading
}

// One-line live readout (spec §1 progressive disclosure: this is all that's
// shown by default besides the instrument and your hands).
export const QanunHud = ({ reading }: QanunHudProps) => (
  <div className="readout">
    <div className="cell maqam">
      <span className="k">maqam</span>
      <span className="v">{reading.maqamName}</span>
    </div>
    <div className="cell">
      <span className="k">tonic</span>
      <span className="v">{midiName(reading.tonicMidi).toLowerCase()}</span>
    </div>
    <div className="cell">
      <span className="k">last</span>
      <span className="v">{reading.lastPluckMidi !== null ? midiName(reading.lastPluckMidi).toLowerCase() : '—'}</span>
    </div>
  </div>
)
```

- [ ] **Step 2: Implement the camera inset (PIP)**

`src/components/CameraInset.tsx`:
```tsx
interface CameraInsetProps {
  enabled: boolean
}

// Small PIP so the player can see their hands. The actual <video>/<canvas>
// live in Stage; this is the framing chrome. frontend-design styles `.camera-inset`.
export const CameraInset = ({ enabled }: CameraInsetProps) =>
  enabled ? <div className="camera-inset" aria-label="your hands" /> : null
```

- [ ] **Step 3: frontend-design pass + verification**

Invoke **frontend-design** for HUD typography (readable over wood) and the PIP frame. Contracts unchanged. Run: `npx tsc -b` → no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/QanunHud.tsx src/components/CameraInset.tsx src/App.css
git commit -m "feat: QanunHud one-line readout + CameraInset PIP frame"
```

---

## Task 20: Controls — tonic, rake sensitivity, jins-pair quick-swaps

**Files:**
- Create: `src/components/Controls.tsx`

- [ ] **Step 1: Implement the opt-in controls panel**

`src/components/Controls.tsx`:
```tsx
import type { MandalState, RakeSensitivity } from '../types'
import { TypedSelect } from './TypedSelect'
import { JINS_PAIRS, isPairActive, type JinsPair } from '../lib/music/sayr/jinsPairs'
import { midiName } from '../lib/music/midiName'

interface ControlsProps {
  tonicMidi: number
  rakeSensitivity: RakeSensitivity
  mandalState: MandalState
  onTonic: (midi: number) => void
  onRakeSensitivity: (s: RakeSensitivity) => void
  onApplyPair: (pair: JinsPair) => void
}

// 12 tonic choices, one per pitch class, anchored near the qanun's low register.
const TONICS = Array.from({ length: 12 }, (_, i) => ({
  value: String(45 + i),
  label: midiName(45 + i)
}))

const RAKE_OPTIONS: ReadonlyArray<{ value: RakeSensitivity; label: string }> = [
  { value: 'off', label: 'rake: off' },
  { value: 'subtle', label: 'rake: subtle' },
  { value: 'full', label: 'rake: full' }
]

// Progressive disclosure (spec §1): tonic + rake + the headline jins-pair
// quick-swaps. Everything deeper (sayr guide, FX, MIDI) is later phases.
export const Controls = ({
  tonicMidi,
  rakeSensitivity,
  mandalState,
  onTonic,
  onRakeSensitivity,
  onApplyPair
}: ControlsProps) => (
  <div className="controls">
    <label className="ctrl">
      <span>tonic</span>
      <TypedSelect
        value={String(tonicMidi)}
        options={TONICS}
        onChange={(v) => onTonic(Number(v))}
      />
    </label>
    <label className="ctrl">
      <span>rake</span>
      <TypedSelect value={rakeSensitivity} options={RAKE_OPTIONS} onChange={onRakeSensitivity} />
    </label>
    <div className="quick-swaps">
      {JINS_PAIRS.map((pair) => (
        <button
          key={pair.id}
          className={`swap ${isPairActive(mandalState, pair) ? 'is-active' : ''}`}
          onClick={() => onApplyPair(pair)}
          title={`${pair.fromLabel} ↔ ${pair.toLabel}`}
        >
          {pair.fromLabel} ↔ {pair.toLabel}
        </button>
      ))}
    </div>
  </div>
)
```

- [ ] **Step 2: frontend-design pass + verification**

Invoke **frontend-design** for the controls' look (a quiet opt-in panel, the active quick-swap lit). Run: `npx tsc -b && npm run lint` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/Controls.tsx src/App.css
git commit -m "feat: Controls — tonic, rake sensitivity, jins-pair quick-swaps"
```

---

## Task 21: Photoreal composition + integration verification

Tie everything into the playable instrument: `Qanun.tsx` composes Stage + overlays + HUD + rack + controls and drives the overlay canvas (finger rings via `lib/draw`). This is the **frontend-design** centerpiece (warm wood/brass soundboard, mandal rack at the left, rosettes, hand overlays). Ends with a real play-test.

**Files:**
- Create: `src/components/Qanun.tsx`
- Modify: `src/App.tsx` (render `<Qanun/>`)
- Modify: `src/hooks/useQanunEngine.ts` (expose `highlightIndex` / `pluckedIndex` + draw finger rings on the canvas)

- [ ] **Step 1: Add overlay drawing + highlight/pluck outputs to the hook**

In `useQanunEngine.ts`: add `const [highlightIndex, setHighlightIndex] = useState<number|null>(null)` and `pluckedIndex` (transient, cleared after a few frames); inside `tick`, after computing the nearest `course` for the primary play hand, `setHighlightIndex(course)`, and on a pluck set `pluckedIndex`. Draw finger rings using the copied `drawFingerRing` + `projectPoint` (clear the canvas each frame, mirror=true), exactly as `useThereminEngine.tick` does. Return `highlightIndex` and `pluckedIndex` from the hook (extend `UseQanunEngine`).

```ts
// add to the hook's state
const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
const [pluckedIndex, setPluckedIndex] = useState<number | null>(null)
const pluckClearRef = useRef(0)
```
```ts
// inside tick, after canvas/ctx are available:
const ctx = canvas.getContext('2d')
if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
// ...for the primary play hand: setHighlightIndex(course)
// ...on a pluck: setPluckedIndex(pluck.courseIndex); pluckClearRef.current = frameCounterRef.current + 6
// ...each frame: if (frameCounterRef.current > pluckClearRef.current) setPluckedIndex(null)
// ...draw rings with drawFingerRing({ ctx, tip, width: canvas.width, height: canvas.height, mirror: true, color: 'rgba(244,242,235,0.9)', radius: 14 })
```
Extend `UseQanunEngine` with `highlightIndex: number | null` and `pluckedIndex: number | null` and return them.

- [ ] **Step 2: Compose `Qanun.tsx`**

`src/components/Qanun.tsx`:
```tsx
import { useRef } from 'react'
import { Stage } from './Stage'
import { StageCover } from './StageCover'
import { StringField } from './StringField'
import { MandalRack } from './MandalRack'
import { QanunHud } from './QanunHud'
import { CameraInset } from './CameraInset'
import { Controls } from './Controls'
import { useQanunEngine } from '../hooks/useQanunEngine'

export const Qanun = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engine = useQanunEngine({ videoRef, canvasRef })

  return (
    <div className="qanun">
      <header className="qanun-header">
        <span className="wordmark">qanun</span>
        <QanunHud reading={engine.reading} />
      </header>

      <Stage
        videoRef={videoRef}
        canvasRef={canvasRef}
        status={engine.status}
        cover={<StageCover status={engine.status} errorMsg={engine.errorMsg} onStart={engine.start} />}
      />

      {/* Soundboard overlays */}
      <MandalRack
        mandalState={engine.mandalState}
        activeDegree={null}
        onCycle={engine.cycleMandalDegree}
      />
      <StringField
        courses={engine.courses}
        highlightIndex={engine.highlightIndex}
        pluckedIndex={engine.pluckedIndex}
      />
      <CameraInset enabled={engine.status === 'running'} />

      <Controls
        tonicMidi={engine.tonicMidi}
        rakeSensitivity={engine.rakeSensitivity}
        mandalState={engine.mandalState}
        onTonic={engine.setTonic}
        onRakeSensitivity={engine.setRakeSensitivity}
        onApplyPair={engine.applyPair}
      />
    </div>
  )
}
```

`src/App.tsx`:
```tsx
import { Qanun } from './components/Qanun'
import './App.css'

export const App = () => (
  <main className="app-root">
    <Qanun />
  </main>
)
```

- [ ] **Step 3: frontend-design — the photoreal shell**

Invoke **frontend-design** to build the warm wood soundboard, brass-and-shadow string treatment, the mandal rack seated at the left, decorative rosettes, the HUD typography, and the layered composition (camera + overlay canvas under the painted soundboard; hands as glowing fingertip rings). Honor the guiding principle: default view = instrument + hands + one-line readout; Controls is a quiet opt-in panel. Strings vertical, pitch low→high left→right.

- [ ] **Step 4: Typecheck, lint, full test run**

Run: `npx tsc -b` → no errors.
Run: `npm run lint` → clean.
Run: `npm run test:run` → every suite green.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Manual play-test (verification-before-completion)**

Run: `npm run dev`, open the served URL in Chrome, click **play**, allow the camera. Verify against the spec:
- The field shows ~28 strings; the HUD reads **Maqam Rast**, tonic **c3**.
- Pinch with the right hand over a string → it plucks (synth), HUD "last" updates; the nearest string highlights as you move.
- A fast horizontal sweep rakes a glissando; a slow move is silent. Toggle rake **off/subtle/full** and confirm the threshold changes.
- Move the **left hand into the far-left mandal zone** and flick vertically on a lever → that degree retunes in every octave, the field + HUD update; the maqam name changes (e.g. lower the 3rd → name shifts).
- Click **Bayati ↔ Saba** and **Hijaz ↔ Hijazkar** quick-swaps → one mandal flips, HUD updates.
- Change the **tonic** → the whole field transposes.

Capture a screenshot of the running instrument for the PR.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Qanun composition + photoreal shell — Phase 1 playable instrument"
```

---

## Self-Review (run against the spec §5 P1 row)

Checked each P1 capability → task that implements it:

- **Vision loop** → T2 (copied vision libs) + T16 (`useQanunEngine.tick`).
- **Scale-locked string field + builder** → T6 `buildField` + T17 `StringField`.
- **nearest/snap** → T9 `nearestCourse`.
- **pinch-pluck** → T10 `detectPluck` + wired in T16.
- **rake** → T11 `detectRake` + rake-sensitivity in T20.
- **7-lever mandal rack + flick** → T4 `MANDALS`/`cycleMandal`, T12 `detectMandal`, T18 `MandalRack`.
- **ajnas identifier + HUD** → T7 `identifyAjnas` + T19 `QanunHud`.
- **jins-pair quick-swaps** → T8 `jinsPairs` + T20 Controls.
- **synth sound** → T13/T14 `createQanunEngine` (PluckSynth).
- **photoreal shell** → T17–T21 (frontend-design).
- **start/permission** → T15 `StageCover` + T16 `start()`.

Pure-function TDD core (the explicit ask): T3 JINS, T4 MANDALS, T5 reachability (**every jins reachable**), T6 buildField, T7 identifyAjnas (**round-trips**), T8 jinsPairs, T9–T12 gesture math, T13 audio helpers — all test-first.

**Type consistency check:** `MandalState`, `Course`, `Jins`, `AjnasIdentity` defined once in `lib/music/types.ts`; `offsetOf`/`setMandal`/`cycleMandal` names consistent across MANDALS, identify, jinsPairs, hook; `JinsPair`/`applyJinsPair`/`isPairActive` consistent across T8 and Controls; `QanunEngine.pluck({freqHz,velocity,time?})` signature identical in T14 and the hook; `RakeSensitivity` defined in `types.ts` and reused by the detector and Controls; `nearestCourse`/`courseScreenX` share `PLAY_FIELD_LEFT/RIGHT`.

**Placeholder scan:** no TBD/"add error handling"/"similar to Task N". Every code step carries complete code. The only delegations are the **frontend-design** visual passes (T17–T21), which keep the pinned component contracts and elevate only the aesthetic — not a logic placeholder.

**Known P1 limitations (documented, by design):** synth-only sound (sampler = P2); identify covers degree-1-rooted families + Saba (Sikah-family maqam identify deferred); jins pairs limited to the two realizable with the literal table; deferred variant ajnas + the two extra mandal positions are a clean follow-up.
