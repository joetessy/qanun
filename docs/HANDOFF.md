# Interactive Web Qanun — Handoff

**Status:** Built and working. A browser-based qanun played with the mouse **or** your hands over a webcam (MediaPipe hand-tracking + Tone.js), with authentic Arabic-maqam tuning, sampled real-kanun sound, and a photoreal wood-and-brass UI.

- **Branch:** `phase-1-core-instrument` (63 commits ahead of `main`; `main` is untouched).
- **Quality gates:** `npm run test:run` → **297 tests pass**; `npx tsc -b` clean; `npm run lint` clean; `npm run build` clean (no chunk > 500 kB).

---

## Run / test / build

```bash
npm install
npm run dev        # Vite dev server (http://localhost:5173)
npm run test:run   # vitest, 297 tests
npm run build      # tsc -b && vite build → dist/
npm run lint
```

Open the dev URL → a first-run **how-to** overlay appears (reopen anytime via the **?** in the header). Click **play** to use the webcam, or just start clicking the strings with the mouse — audio works without a camera.

---

## How to play

**Mouse:** click a string = pluck · click-drag across strings = glide · click-and-hold = sustain.

**Webcam (the pinch is a button):**
- **pinch + release** → quick pluck
- **pinch + hold** → sustain (rashsh tremolo)
- **pinch + hold + move** → glide across strings
- the **left hand** also operates the mandal levers / can flick to retune (the right hand plays).

**Modulate** (keep root + tonic, change the tuning) — three complementary controls, all mouse-clickable and always visible:
1. **Mandal panel** (left) — 7 per-degree switches (note name + accidental, lit when altered); click/▲▼ to cycle a degree's quarter-tone. Models the Oriental-keyboard quarter-tone switch row.
2. **Upper-jins switcher** ("UPPER JINS on …") — swap the upper jins on the **ghammāz**, keeping the root jins: Rast → Upper Rast / Nahawand / Hijaz / Bayati; Bayati → Nahawand / Rast / Hijaz; etc.
3. **Maqam presets** (bottom rail) — one-tap whole-maqam jumps (Rast, Suznak, Nahawand, Bayati, Hijaz, Kurd, Nikriz, Saba) + reset.

**Tune drawer** (top-right): tonic, **trill** toggle, **Sample/Synth** toggle, **sayr guide** + **emphasis overlay** toggles, and the studio tools (record WAV, drone, metronome, MIDI out).

---

## Architecture

**Stack:** React 19 + TypeScript (strict) + Vite 8 · Tone.js 15 · `@mediapipe/tasks-vision` (GPU hand landmarker) · One-Euro smoothing · Vitest (jsdom). Built on the `../theremin` foundation (vision/smoothing/draw/recorder/practice modules vendored from it).

**Principle:** the **music model and gesture math are a pure-function, test-first core** (no DOM/audio/React); a thin `useQanunEngine` frame-loop wires detect → hand-role → gesture → audio + state; components render over a mirrored camera.

| Area | Location | What |
|---|---|---|
| Music model | `src/lib/music/` | `ajnas/JINS.ts` (jins table), `ajnas/MANDALS.ts` (tuning positions; degree-1 fixed, degree-5 now variable), `buildField.ts` (scale-locked course field), `identifyAjnas.ts` + `MAQAM_NAMES.ts`, `MAQAM_PRESETS.ts`, `degreeLabel.ts` |
| Sayr / guidance | `src/lib/music/sayr/` | `SAYR_NETWORKS.ts`, `suggestModulations.ts`, `emphasisNotes.ts`, `jinsPairs.ts`, `upperJins.ts` (ghammāz family switcher) |
| Gesture math | `src/lib/gesture/` | `nearestCourse.ts`, `pinchPlay.ts` (the pinch-as-button state machine), `detectMandal.ts`, `pointerPlay.ts` (mouse) |
| Audio | `src/lib/audio/` | `createQanunEngine.ts` (Tone.Sampler + Chorus / PluckSynth pool, triple-course bloom, rashsh `holdStart`, `trill`, reverb), `qanunSamples.ts`, `detuneCluster.ts`, `velocityCurve.ts`, recorder (`createRecorder` + worklet) |
| MIDI | `src/lib/midi/` | `microtonal.ts` (freq→note+bend), `createMidiOut.ts` (web MIDI, MPE pitch-bend per pluck) |
| Practice | `src/lib/practice/` | `createDrone.ts`, `createMetronome.ts`, `tapTempo.ts` |
| Vision / draw / smoothing | `src/lib/{vision,draw,oneEuro}/` | vendored from theremin |
| Frame loop | `src/hooks/useQanunEngine.ts` | the orchestrator; `deriveHandRoles.ts` |
| UI | `src/components/` | `Qanun` (composition), `Stage`/`StageCover`, `StringField`, `MandalRack`, `MaqamPresets`, `UpperJinsSwitcher`, `QanunHud`, `CameraInset`, `Controls`, `SayrGuide`, `EmphasisOverlay`, `Onboarding`, `Rosette` |

Data flow per frame: `detect → findHandedness → deriveHandRoles → { left in mandal zone → detectMandal→cycleMandal→rebuild field+identify ; playing hands → nearestCourse → pinchPlay → engine.pluck/holdStart/trill (+ MIDI) } → draw finger rings`.

---

## Sound & samples

- **Sampled voice (default):** `Tone.Sampler` over **18 per-note WAVs of a real Turkish kanun**, sliced from a **CC0 / public-domain** recording (Bozkurt, Freesound #211133). Attribution in `public/samples/qanun/NOTICE.md`. Tone pitch-shifts them to every chromatic + quarter-tone. A subtle `Tone.Chorus` adds the triple-course shimmer.
- **Synth fallback:** `Tone.PluckSynth` voice pool (Karplus-Strong, triple-course detuned bloom). Used while samples load and via the **Synth** toggle.
- **Sustain** is **rashsh** (a ~7 Hz tremolo re-trigger while held), the qanun's real sustain technique — not an envelope hack.

---

## Key design decisions (see `docs/superpowers/specs/`)

- **`2026-06-08-...-design.md`** — the original approved design (music model, scale-locked field, mandal modulation, sayr, phasing).
- **`2026-06-09-interaction-v2-and-sound.md`** — the post-playtest rework: Oriental-keyboard modulation panel + presets, rashsh/triple-course sustain, trill, mouse control. **Cited sources** for each.
- **Late additions (this build, beyond the v2 doc):** the **ghammāz upper-jins switcher** (`upperJins.ts`); **relaxing the 5th degree** to a movable lever (it was the fixed pillar blocking Hijaz/Bayati uppers-on-the-ghammāz); the **pinch-as-button** hand gesture (unifying hand + mouse); and replacing the placeholder zither samples with the **real CC0 kanun** set.
- Theory references: `docs/MUSIC-THEORY.md`, `docs/research/{ajnas-reference,sayr-reference,maqam-sayr-catalog}.md`. Sample sourcing notes: `docs/research/qanun-samples.md`.

---

## Known limitations / caveats

- **Sample fidelity:** the only license-clear *real-kanun* source is a 160 kbps mono recording, so it's authentic but not studio-grade (mild softness on attacks). The Sampler map (`qanunSamples.ts`) accepts a higher-fidelity license-clear set as a drop-in if one is found.
- **MIDI out** is verified by unit tests (bend math + send path with a mocked Web-MIDI), **not** against a live device — confirm with a real synth.
- **Light theme** is intentionally deferred (the warm dark wood is the instrument's identity); a `TODO` marks it in `App.css`.
- **identifyAjnas** names the degree-1-rooted families + Saba; half-flat-tonic (Sikah-family) maqam *naming* is a known gap (the Sikah jins is still reachable/playable).
- **Degree 1** (the tonic) remains a fixed pillar.
- The live **webcam feel** (ring tracking, pinch responsiveness) can only be judged by playing — it's the one thing the test suite can't cover.

---

## Repo state & next steps

- `phase-1-core-instrument` holds the full build; `main` is untouched. Suggested next: **merge to `main`** (or push + open a PR — no git remote is configured yet), then optionally: chase a higher-fidelity license-clear kanun set, add Turkish 53-koma mandal mode, or build the light theme.
