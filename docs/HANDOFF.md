# Interactive Web Qanun — Session Handoff

**Date:** 2026-06-08
**Status:** Design + theory complete. **No application code yet.** Implementation plan to be written in the next session.

---

## What this project is
A browser-based qanun played with your hands over a webcam (MediaPipe hand tracking + Tone.js audio), built on the `../theremin` codebase as a foundation. It should sound like a real qanun (samples), be easy to play, and let you modulate freely between ajnas by working a mandal rack. Full background in the spec.

## Where we are
This session covered the entire **brainstorming → spec → research** arc:
1. Studied the `../theremin` reference (reusable vision / audio / React modules).
2. Designed the instrument interactively (plucking model, string field, mandal-based modulation, sound, sayr guidance) — all decisions captured in the spec.
3. Researched the music theory deeply and compiled it into a knowledge base + companion references.
4. Wrote and revised the spec; it is internally consistent and committed.

**The implementation plan was intentionally NOT written here** — that's the first task of the next session (see the prompt below).

## Key decisions (all in the spec)
- **Foundation:** reuse theremin's stack — React 19 + TS + Vite, Tone.js, `@mediapipe/tasks-vision`, One-Euro smoothing, and its vision/audio/practice/MIDI libs.
- **Playing (both hands):** pinch = precise pluck; fast cross-sweep = glissando rake; always live (no mode switch); snap-to-nearest; rake-sensitivity control.
- **String field:** full realistic ~26 courses / ~3.5 octaves, **scale-locked** (a glide runs the maqam; never chromatic).
- **Modulation = the mandal rack (technique 1 ONLY).** 7 degree-mandals; left hand flicks to retune a degree (every octave follows). We do **not** model/detect technique 2 (tonicizing a new degree) — that's left to the player's melody.
- **Sayr guidance (under the hood depth, simple surface):** per-maqam sayr networks drive **ordered idiomatic mandal-preset suggestions** (the "sayr guide"); an optional **emphasis overlay** glows the tonic/ghammāz/etc. on the strings. Jins-pair single-flip quick-swaps are first-class.
- **Sound:** sampled qanun via `Tone.Sampler` (quarter-tones free via pitch-shift; trichord shimmer inherent) + Karplus-Strong synth fallback. **Sourcing a license-clear sample set is an open task.**
- **Scope (full v1):** core instrument + recording/export + drone/metronome + MIDI out (microtonal pitch-bend). Phased P1–P5.
- **Visuals:** photoreal qanun, built with the **frontend-design** skill at implementation; hand overlays + small camera inset.
- **GUIDING PRINCIPLE:** *simplest UX, possibilities intact* — zero-config start, progressive disclosure, passive guidance, one small gesture vocabulary, smart defaults. This **outranks feature-completeness**.

## Repo state
```
docs/
  HANDOFF.md                    ← this file
  NEXT-SESSION-PROMPT.md        ← paste into the next session
  MUSIC-THEORY.md               ← consolidated theory knowledge base (start here for theory)
  superpowers/specs/2026-06-08-interactive-web-qanun-design.md   ← THE SPEC
  research/
    ajnas-reference.md          ← jins intervals/ghammāz (maqamworld/maqamlessons)
    sayr-reference.md           ← sayr/modulation engine model (Inside Arabic Music chs 13–20)
    maqam-sayr-catalog.md       ← per-maqam sayr pathways (Inside Arabic Music ch 24)
.gitignore
```
No `package.json`, `src/`, or app code yet. All work is committed to git on the default branch.
(Brainstorm mockups are under `.superpowers/brainstorm/…`, gitignored.)

## Open items / risks
1. **Sample sourcing** — find a license-clear qanun multisample; synth fallback de-risks it. *(Owner: next session.)*
2. **Targeting precision at ~26 courses** — mitigated by snap-to-nearest + scale-lock; fallback is to narrow the visible range ("adjust if too hard").
3. **Microtonal MIDI** — quarter-tones need per-note pitch-bend (MPE-style); reuse theremin's bend handling.
4. **Mandal-flick reliability** — pinch-to-cycle fallback; generous hit-boxes.

## Next steps (next session)
1. Read the spec, then `MUSIC-THEORY.md` (skim the three `research/` companions).
2. Use **writing-plans** to produce a bite-sized TDD implementation plan for **Phase 1** (the core playable instrument), saved to `docs/superpowers/plans/`.
3. Execute it with **subagent-driven-development**; use **frontend-design** for the photoreal UI.
4. Continue with phases P2–P5.

The ready-to-paste prompt is in [`NEXT-SESSION-PROMPT.md`](NEXT-SESSION-PROMPT.md).
