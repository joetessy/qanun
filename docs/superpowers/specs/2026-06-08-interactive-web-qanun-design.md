# Interactive Web Qanun — Design

**Date:** 2026-06-08
**Status:** Approved design → ready for implementation plan
**Reference instrument:** `../theremin` (reuse its vision/audio/React foundation)
**Companion reference:** [`docs/research/ajnas-reference.md`](../../research/ajnas-reference.md) — verified ajnas data from maqamworld.com & maqamlessons.com

---

## 1. North star

A browser-based qanun you play with your hands over a webcam. It should **sound like a real qanun**, **be easy to pick up**, and let you **modulate freely between ajnas** the way a real player does — by working the mandals. Realistic tuning (never chromatic), realistic sound (samples), realistic look (frontend-design).

### Goals
- Play melodies and fast runs with both hands, touchlessly, with low latency.
- Authentic Arabic tuning: scale-locked strings, quarter-tones, a glide runs the *maqam*.
- Free, intuitive modulation between ajnas via a physical mandal rack.
- A real qanun timbre (sampled), including the trichord shimmer.
- Photoreal, instrument-like presentation.

### Non-goals (v1)
- Turkish qanun comma-level microtuning (72-EDO mandals). We use 24-EDO (quarter-tone) positions.
- Per-course independent mandals (we group mandals by the 7 degrees; all octaves of a degree move together).
- Mobile/touch UI, multiplayer, recording-to-cloud. Desktop browser (Chrome/Edge, GPU) first.

---

## 2. The music model (the heart)

### 2.1 Jins as the unit
A **jins** is a 3–5 note cell: `{ id, intervals[], ghammazDegree }` where `intervals` are semitones from the jins tonic with **half-flat = .5** (e.g. Rast `[0,2,3.5,5,7]`, Bayati `[0,1.5,3,5]`, Hijaz `[0,1,4,5]`). The full verified table (~25 ajnas) lives in `docs/research/ajnas-reference.md` and is transcribed into `music/ajnas/JINS.ts`.

A **maqam** is an ordered chain `[(jins, startDegree), …]`: a lower jins on the tonic plus an upper jins whose tonic is the lower jins's **ghammāz** (the 4th for tetrachords, 5th for pentachords, 3rd for trichords). The two overlap by one shared note. Modulation = swapping/pivoting a jins on a shared tone (ghammāz first, then tonic, then the neutral third).

### 2.2 The instrument's tuning — scale-locked, mandal-driven
The qanun is **not chromatic**. It has **7 courses per octave** (one per scale degree) across ~3.5 octaves ≈ **26 courses**. We model the live tuning as:

- **Tonic** — a user-selectable MIDI pitch (default **C**, octave anchored so the field spans roughly the qanun's real range). All degrees are relative to it.
- **Mandal state** — one position per degree (7 mandals). Each degree offers the accidentals a real Arabic qanun provides:

  | Degree | Positions (semitone offset from tonic) | Default (Rast) |
  |---|---|---|
  | 1 (root) | fixed `0` | 0 |
  | 2 | flat `1` · half-flat `1.5` · natural `2` | 2 |
  | 3 | flat `3` · half-flat `3.5` · natural `4` | 3.5 |
  | 4 | dim `4`* · natural `5` · raised `6`* | 5 |
  | 5 | fixed `7` (pillar) | 7 |
  | 6 | flat `8` · half-flat `8.5` · natural `9` | 9 |
  | 7 | flat `10` · half-flat `10.5` · natural `11` | 10.5 |

  \*Degree-4 *dim* (offset 4) gives Saba's lowered 4th; *raised* (offset 6) gives the augmented 4th of Nikriz / upper-Hijaz (which sits a semitone below the fixed 5th). Degrees 1 & 5 are fixed pillars in v1 (a known limitation; revisit if a needed jins requires moving them). These position sets are refined during implementation against the ajnas table — the test suite asserts that every jins in `JINS.ts` is reachable.

- **String field builder** — `buildField(tonicMidi, mandalState) → Course[]`. For each octave `o` in range and degree `d` in `0..6`: `pitchMidi = tonicMidi + 12*o + offset(d, mandalState[d])`. Produces ~26 ordered courses (trimmed to the real range). Each `Course = { index, degree, octave, midi, freqHz }`. This array *is* the on-screen string field; a glide across it runs the maqam by construction.

### 2.3 Naming what you play
`identifyAjnas(mandalState) → { lower, upper, maqamName }`: match degrees `1..ghammāz` against jins interval patterns for the **lower jins**, and degrees from the ghammāz upward for the **upper jins**; look up the pair in a maqam table for a friendly name ("Maqam Rast"), else report the ajnas ("Rast ▸ Hijaz") or "custom". Drives the live HUD readout.

### 2.4 Idiomatic jumps (optional assist)
From the current lower/upper jins, `suggestModulations()` returns the idiomatic moves from the modulation map (e.g. Rast → Nahawand@5, → Hijaz@5, → Sikah@3). Selecting one sets the relevant mandal positions in a single action. Optional convenience layer, not the primary modulation path.

---

## 3. Interaction model

### 3.1 Hands & zones
- **Both hands pluck** the string field. **Right hand** plays only. **Left hand** plays *and* modulates.
- The stage splits into a **mandal zone** (far left ~15–18% width, where real mandals sit) and the **play field** (the rest).
- **Left hand in the mandal zone → mandal mode**; elsewhere → play. Clear spatial separation prevents gesture conflict and mirrors the real instrument's geography.

### 3.2 Playing gestures (always live together)
- **Nearest-string + snap** — fingertip x maps to the nearest course; that course highlights. Snap-to-nearest makes ~3.7% spacing forgiving, and scale-lock means an off-by-one is still in-maqam.
- **Pinch-pluck (precise)** — thumb-tip↔index-tip distance crossing a threshold (onset edge) triggers the nearest course. Sample the target at onset to avoid index drift during the pinch. Velocity from pinch speed (fallback: fixed).
- **Rake (glissando)** — index-fingertip horizontal velocity above a threshold *while crossing course boundaries* plucks each crossed course in turn; speed → loudness. A **rake-sensitivity** control (off / subtle / full) sets the threshold so beginners avoid accidental glissandos and pros can rip. Slow repositioning stays silent.

### 3.3 Mandal gesture
- In the mandal zone, the fingertip's vertical position selects one of the 7 levers; a **vertical flick** (sign of y-velocity) raises/lowers that degree to its next position. **Pinch-to-cycle** is a reliable fallback. The affected degree retunes in *every* octave; the field and HUD update immediately; a short pitch-glide on any sounding strings avoids clicks.

### 3.4 Smoothing
One-Euro filter on every tracked point (low cutoff at rest = zero shake; high cutoff in motion = no lag), reused from theremin `lib/oneEuro`.

---

## 4. Audio engine

`audio/createQanunEngine.ts` (factory, mirrors theremin's `createAudioEngine` shape):

- **Primary: `Tone.Sampler`** loaded with a real qanun **multisample** (a handful of recorded pitches mapped across the range). `triggerAttack(freqHz, time, velocity)` accepts arbitrary frequencies, so **quarter-tones come free** from pitch-shifting the nearest sample. The 3-strings-per-course **trichord shimmer is inherent** in real recordings; an optional subtle detuned-layer toggle can reinforce it.
- **Fallback: `Tone.PluckSynth`** (Karplus-Strong) when samples haven't loaded / for an offline mode. Same `pluck(course, velocity)` interface, so the rest of the app is sample/synth agnostic.
- **Polyphony** sized for chords + fast runs (≥16 voices). Per-course pluck with natural decay.
- **FX bus** reused from theremin: reverb (for body) on a shared `sumBus`; recorder and practice modules tap the same bus.
- **Sample sourcing** (my task): research license-clear qanun multisamples, pick the best, document license, wire in. Synth fallback de-risks delivery.

---

## 5. Scope (v1 = full) and phasing

All of the following are **in v1**. Phasing orders the work; it is not a scope cut.

| Phase | Contents |
|---|---|
| **P1 — Core instrument** | Vision loop, string field + builder, nearest/snap, pinch-pluck, rake, mandal rack + flick, ajnas identifier + HUD readout, **synth** sound, photoreal shell (frontend-design), start/permission flow. |
| **P2 — Real sound** | Source + wire qanun multisample into `Tone.Sampler`; trichord layer; reverb tuning. |
| **P3 — Studio extras** | WAV **recording/export** (reuse `lib/audio/createRecorder` + worklet), **drone** + **metronome** practice tools (reuse `lib/practice`), **MIDI out** (reuse `lib/midi`) with **microtonal pitch-bend** (per-note channel / MPE-style; expose bend-range; quarter-tone = bend offset). |
| **P4 — Polish** | Idiomatic-jumps assist, tonic/maqam presets, onboarding, light/dark + responsive, performance pass. |

---

## 6. Architecture

Build on theremin's structure (React 19 + TS strict + Vite, Tone.js, `@mediapipe/tasks-vision`, factory-function libs, hooks+refs state, vitest).

### Reused largely as-is
`lib/vision/*` (camera lifecycle, `loadHandLandmarker`, frame-synced detect loop, `findHandedness`, `pinchDistance`, constants) · `lib/oneEuro/*` · `lib/audio` FX/output-bus + `createRecorder` + worklet · `lib/practice` (drone, metronome) · `lib/midi` (engine, with microtonal extension) · React shell (`Stage`, `StageCover`, `Hud`, `Controls`, header, `TypedSelect`).

### New for the qanun
| Module | Responsibility |
|---|---|
| `lib/music/ajnas/JINS.ts` | The ~25 jins table `{id, intervals, ghammazDegree}`. |
| `lib/music/ajnas/MANDALS.ts` | Per-degree position sets + offset resolver. |
| `lib/music/buildField.ts` | `(tonic, mandalState) → Course[]` (~26 courses). |
| `lib/music/identifyAjnas.ts` | Read mandal state → `{lower, upper, maqamName}`. |
| `lib/music/modulationMap.ts` | Idiomatic-jump suggestions. |
| `lib/gesture/nearestCourse.ts` | x → nearest course + snap + highlight. |
| `lib/gesture/detectPluck.ts` | Pinch-onset + rake (cross-velocity) detection. |
| `lib/gesture/detectMandal.ts` | Zone test + lever select + flick/cycle. |
| `lib/audio/createQanunEngine.ts` | Sampler + PluckSynth fallback, per-course pluck, FX. |
| `components/StringField.tsx` | Render courses, highlight, pluck feedback. |
| `components/MandalRack.tsx` | 7 levers, positions, flip animation. |
| `components/QanunHud.tsx` | Live tonic / ajnas / maqam readout. |
| `components/CameraInset.tsx` | Small PIP of the user's hands. |
| `hooks/useQanunEngine.ts` | Frame loop: detect → per-hand role → gesture → audio + state. |

### Data flow (per video frame)
```
detect(2 hands) → smooth fingertips (One-Euro)
  ├─ left hand in mandal zone?  → detectMandal → update mandalState
  │                                → buildField + identifyAjnas (recompute)
  └─ else (each playing hand)   → nearestCourse(+snap)
                                  → detectPluck → engine.pluck(course, vel)
state: { tonicMidi, mandalState[7], ajnas/maqam name, rakeSensitivity,
         soundSource, fx, midi, recording } (hooks + refs; no global store)
```

---

## 7. Visual / UX

- **Composition:** a photoreal qanun **soundboard** is the playing surface — warm wood, brass strings, the **mandal rack** at the left, decorative rosettes. Hands appear as **overlays** (fingertip rings; optional faint skeleton) positioned over the strings. A small **camera inset** (PIP) lets you see your hands for feedback. Top bar: wordmark, status, live tonic + maqam/ajnas readout. Minimal controls: tonic, rake sensitivity, sound source, FX, record, practice, MIDI, idiomatic-jumps.
- **Orientation:** strings are vertical (pitch = horizontal, low→high left→right) for comfortable horizontal rakes and an intuitive pitch axis; realism comes from materials, not literal qanun orientation. (Documented trade-off.)
- **Built with the frontend-design skill** at implementation for a distinctive, non-generic, instrument-grade look.
- **Theme:** warm, wood/brass instrument aesthetic; readable HUD typography; light/dark in P4.

---

## 8. Risks & open questions
1. **Sample sourcing / licensing** — *Mitigation:* synth fallback; document license; allow user-supplied set.
2. **Targeting precision at ~26 courses** — *Mitigation:* snap-to-nearest + scale-lock + clear nearest-string highlight. *Fallback:* reduce visible range / add register window (we explicitly chose full range, "adjust if too hard").
3. **Microtonal MIDI** — quarter-tones need per-note pitch-bend (MPE-style channel rotation). *Mitigation:* reuse theremin bend handling; expose bend range; test against a soft-synth.
4. **Mandal-flick reliability** — vertical flick can misfire. *Mitigation:* pinch-to-cycle fallback; generous lever hit-boxes; dwell confirmation.
5. **Left-hand role switching** — accidental zone entry while playing. *Mitigation:* far-left zone, hysteresis on the boundary, visible mode indicator.
6. **Performance** — MediaPipe GPU + Tone polyphony. Expected fine on desktop; budget a perf pass in P4.

---

## 9. Testing strategy (vitest, reuse theremin patterns)
- **Music model (heaviest):** every jins's intervals; `buildField` pitches & range; **`identifyAjnas` round-trips** (each maqam's mandal state names correctly); reachability (every jins in `JINS.ts` is producible from the mandal positions); modulation-map suggestions.
- **Gesture math:** `nearestCourse` + snap; pinch onset edge; rake cross-velocity thresholds — driven by synthetic landmark sequences (no camera).
- **Audio mapping:** course → frequency; velocity curve; sample/synth interface parity.
- **Reused modules** keep their existing tests (recorder, metronome, drone, MIDI).

---

## 10. Build / run
`npm run dev` (Vite) · `npm test` (vitest) · `npm run build`. Same toolchain as theremin; camera permission + a "start" gesture to begin (Tone.js requires a user gesture to start audio).
