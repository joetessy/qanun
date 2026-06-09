# Interactive Web Qanun — Design

**Date:** 2026-06-08
**Status:** Approved design + compiled theory → implementation plan to be written in a fresh session (see [`docs/HANDOFF.md`](../../HANDOFF.md))
**Reference instrument:** `../theremin` (reuse its vision/audio/React foundation)
**Companion references:**
- [`docs/research/ajnas-reference.md`](../../research/ajnas-reference.md) — verified jins intervals (maqamworld.com & maqamlessons.com)
- [`docs/research/sayr-reference.md`](../../research/sayr-reference.md) — the sayr/modulation engine model (*Inside Arabic Music*, chs 13–20)
- [`docs/research/maqam-sayr-catalog.md`](../../research/maqam-sayr-catalog.md) — per-maqam sayr pathways (*Inside Arabic Music*, ch 24)

---

## 1. North star

A browser-based qanun you play with your hands over a webcam. It should **sound like a real qanun**, **be easy to pick up**, and let you **modulate freely between ajnas** the way a real player does — by working the mandals. Realistic tuning (never chromatic), realistic sound (samples), realistic look (frontend-design).

### Goals
- Play melodies and fast runs with both hands, touchlessly, with low latency.
- Authentic Arabic tuning: scale-locked strings, quarter-tones, a glide runs the *maqam*.
- Free, intuitive modulation between ajnas via a physical mandal rack.
- Guidance from each maqam's *sayr* — emphasis notes highlighted, idiomatic modulations surfaced in the order real players use them.
- A real qanun timbre (sampled), including the trichord shimmer.
- Photoreal, instrument-like presentation.

### Non-goals (v1)
- Turkish qanun comma-level microtuning (72-EDO mandals). We use 24-EDO (quarter-tone) positions.
- Per-course independent mandals (we group mandals by the 7 degrees; all octaves of a degree move together).
- Mobile/touch UI, multiplayer, recording-to-cloud. Desktop browser (Chrome/Edge, GPU) first.

### Guiding principle: simplest UX, possibilities intact
Depth lives under the hood; the surface stays minimal. **This principle outranks feature-completeness** — if a capability can't be made simple, it hides until invoked.
- **Zero-config start.** Load → allow camera → play immediately in a sane default (Rast on C). No setup screens or menus to read first.
- **Progressive disclosure.** Default view = the instrument, your hands, and a one-line readout. Mandal detail, sayr guide, FX, recording, MIDI, presets are opt-in panels — one tap away, never in the way.
- **Guidance, not configuration.** The emphasis overlay and sayr guide are *passive hints* that make good playing easier; they need no interaction and can be dimmed or toggled off.
- **One small gesture vocabulary.** Pinch = pluck, sweep = glissando, left-hand flick (in the mandal zone) = modulate. Everything else is guided or automatic.
- **Smart defaults, full reach.** Every possibility (any maqam, free per-mandal control, jins-pair swaps, sound source, MIDI) has a sane default and is reachable — but nothing demands an up-front decision.

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

### 2.4 Sayr & modulation model
Modulation is driven by each maqam's **sayr** — its idiomatic melodic pathway — not a flat reachability list. (Full model in `docs/research/sayr-reference.md`; per-maqam data in `maqam-sayr-catalog.md`.)

- **Modulation = mandals (technique 1 only).** *Inside Arabic Music* names two techniques: (1) **altering intervals** on the same tonic, and (2) **tonicizing a new degree**. We implement **only technique 1** — flipping mandals. We do **not** model, detect, or handle technique 2; shifting the tonal centre is left entirely to the player's melodic choices, with no detection and no special handling. The mental model stays dead simple: **the mandals are the modulation.**
- **Sayr network.** Each maqam carries a small **weighted directed graph**: nodes = `jins@degree` (with an emphasis weight and start/cadence flags), edges = idiomatic modulations weighted by how heavily trafficked they are. Seeded from the catalog. `lib/music/sayr/` holds this data and the traversal/suggestion logic.
- **`suggestModulations(mandalState, tonic)`** returns the idiomatic next moves **ordered by edge weight** (sayr traffic), each tagged by relationship (jins-pair swap / same-family upper-jins change / shared-ghammāz neighbour). Every suggestion is a **mandal preset** — selecting it flips the relevant mandals. (Pure technique 1.)
- **Jins-pair quick-swaps (first-class).** The five single-accidental pairs — Bayati↔Saba, Nahawand↔Nahawand Murassaʿ, Sikah↔Mukhalif Sharqi, Rast↔Sazkar, Hijaz↔Hijazkar — are one-mandal flips surfaced as headline swaps. Nahawand↔Nikriz is **excluded** as a fluid swap (idiomatically a dramatic contrast, not a swap).

### 2.5 Notes of melodic emphasis
For the current maqam, `emphasisNotes(maqam)` returns the **tonic (qarar)**, **ghammāz** (primary modulation hub), **octave**, **leading tone** (per-jins interval below the tonic), and the **ʿatabāt** (ordered rest-steps of the ascent). These are highlighted on the string field to guide the sayr, and weight an optional tonic drone/tremolo (the qanun *rashsh*). Data and weights per `sayr-reference.md §3`.

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

### 3.5 Sayr guidance (emphasis overlay + sayr guide)
- **Emphasis overlay** — the current maqam's emphasis notes (§2.5) glow on the string field: tonic and ghammāz most strongly, then octave, leading tone, and the ʿatabāt staircase. Optional, passive guidance toward idiomatic melody (off by default per §1).
- **Sayr guide** — in the mandal zone, an optional panel shows `suggestModulations()` for the current jins: the idiomatic next moves ordered by traffic, jins-pair swaps flagged, and the cadence (qafla) hinted. This is the upgraded "idiomatic jumps." Pinch a suggestion to apply it.

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
| **P1 — Core instrument** | Vision loop, string field + builder, nearest/snap, pinch-pluck, rake, mandal rack + flick, ajnas identifier + HUD readout, **jins-pair quick-swaps**, **synth** sound, photoreal shell (frontend-design), start/permission flow. |
| **P2 — Real sound** | Source + wire qanun multisample into `Tone.Sampler`; trichord layer; reverb tuning. |
| **P3 — Sayr & guided modulation** | Per-maqam **sayr networks** (data from `maqam-sayr-catalog.md`) + the **sayr guide** panel (weighted `suggestModulations`, all mandal presets) + the **emphasis-note overlay**; tonic/maqam presets. |
| **P4 — Studio extras** | WAV **recording/export** (reuse `lib/audio/createRecorder` + worklet), **drone** + **metronome** practice tools (reuse `lib/practice`), **MIDI out** (reuse `lib/midi`) with **microtonal pitch-bend** (per-note channel / MPE-style; expose bend-range; quarter-tone = bend offset). |
| **P5 — Polish** | Onboarding, light/dark + responsive, performance pass. |

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
| `lib/music/sayr/SAYR_NETWORKS.ts` | Per-maqam weighted node/edge graphs (from the catalog). |
| `lib/music/sayr/jinsPairs.ts` | The 5 jins-pair swaps (+ Nahawand↔Nikriz exclusion). |
| `lib/music/sayr/emphasisNotes.ts` | Tonic/ghammāz/octave/leading-tone/ʿatabāt for a maqam. |
| `lib/music/sayr/suggestModulations.ts` | Weighted, technique-tagged modulation suggestions. |
| `lib/gesture/nearestCourse.ts` | x → nearest course + snap + highlight. |
| `lib/gesture/detectPluck.ts` | Pinch-onset + rake (cross-velocity) detection. |
| `lib/gesture/detectMandal.ts` | Zone test + lever select + flick/cycle. |
| `lib/audio/createQanunEngine.ts` | Sampler + PluckSynth fallback, per-course pluck, FX. |
| `components/StringField.tsx` | Render courses, highlight, pluck feedback. |
| `components/MandalRack.tsx` | 7 levers, positions, flip animation. |
| `components/QanunHud.tsx` | Live tonic / ajnas / maqam readout. |
| `components/CameraInset.tsx` | Small PIP of the user's hands. |
| `components/EmphasisOverlay.tsx` | Glow the maqam's emphasis notes on the field. |
| `components/SayrGuide.tsx` | The sayr-aware modulation suggestion panel. |
| `hooks/useQanunEngine.ts` | Frame loop: detect → per-hand role → gesture → audio + state. |

### Data flow (per video frame)
```
detect(2 hands) → smooth fingertips (One-Euro)
  ├─ left hand in mandal zone?  → detectMandal → update mandalState
  │                                → buildField + identifyAjnas + emphasisNotes + suggestModulations (recompute)
  └─ else (each playing hand)   → nearestCourse(+snap)
                                  → detectPluck → engine.pluck(course, vel)
state: { tonicMidi, mandalState[7], ajnas/maqam name, rakeSensitivity,
         soundSource, fx, midi, recording } (hooks + refs; no global store)
```

---

## 7. Visual / UX

- **Composition:** a photoreal qanun **soundboard** is the playing surface — warm wood, brass strings, the **mandal rack** at the left, decorative rosettes. Hands appear as **overlays** (fingertip rings; optional faint skeleton) positioned over the strings. A small **camera inset** (PIP) lets you see your hands for feedback. Top bar: wordmark, status, live tonic + maqam/ajnas readout. **Progressive disclosure (see §1 guiding principle):** the default view is just the instrument, your hands, and a one-line readout; all controls — tonic, rake sensitivity, sound source, FX, record, practice, MIDI, sayr guide — live in opt-in panels one tap away. The current maqam's **emphasis notes glow on the strings** as you play (the sayr overlay).
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
6. **Performance** — MediaPipe GPU + Tone polyphony. Expected fine on desktop; budget a perf pass in P5.
7. **Sayr data fidelity** — the network model simplifies a living oral tradition. *Mitigation:* seed from the catalog for the common maqamat, mark the rest "custom," and treat the guide as suggestions, never constraints.

---

## 9. Testing strategy (vitest, reuse theremin patterns)
- **Music model (heaviest):** every jins's intervals; `buildField` pitches & range; **`identifyAjnas` round-trips** (each maqam's mandal state names correctly); reachability (every jins in `JINS.ts` is producible from the mandal positions).
- **Sayr model:** jins-pair swaps are single-accidental and bidirectional (and Nahawand↔Nikriz is *not* a pair); `emphasisNotes` returns the right tonic/ghammāz per maqam; `suggestModulations` returns catalog-ordered, technique-tagged moves for Rast/Bayati/Hijaz.
- **Gesture math:** `nearestCourse` + snap; pinch onset edge; rake cross-velocity thresholds — driven by synthetic landmark sequences (no camera).
- **Audio mapping:** course → frequency; velocity curve; sample/synth interface parity.
- **Reused modules** keep their existing tests (recorder, metronome, drone, MIDI).

---

## 10. Build / run
`npm run dev` (Vite) · `npm test` (vitest) · `npm run build`. Same toolchain as theremin; camera permission + a "start" gesture to begin (Tone.js requires a user gesture to start audio).
