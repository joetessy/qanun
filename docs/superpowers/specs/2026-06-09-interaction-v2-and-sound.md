# Interaction v2 + Sound — Design decisions

**Date:** 2026-06-09
**Status:** approved direction (grounded in research) → implementing across the remaining phases.
**Supersedes** the relevant parts of the v1 spec (§3 interaction, §4 audio) where they conflict.

These decisions answer the user's feedback after playing Phase 1: modulation felt unreliable / "not working right," the sound was "very plucky, no sustain," they couldn't modulate without the mouse, and they want a trill + mouse control. Research (Oriental-keyboard mechanism, qanun ornaments) is summarized inline with sources.

---

## 1. Modulation = an Oriental-keyboard-style switch panel (not a gesture)

**Why.** Real Arabic/Oriental electronic keyboards (Korg Pa-series Oriental, Ketron VEGA, Medeli) modulate via a **row of per-pitch-class latch toggles** — each lowers that note by a quarter-tone, stays engaged, and is **lit so the current scale is glanceable** — plus **one-tap maqam presets** and a **cancel/reset** button. The Arabic accordion can't retune mid-piece at all; the keyboard panel is the model players actually use to modulate live. A transient hand-flick is the wrong mental model. (Sources: maqamworld.com keyboard/accordion pages; Korg Pa4X/Pa700/Pa5X Oriental; Ketron VEGA manual.)

**Decision.** Promote the **mandal rack into the primary, always-visible modulation panel** — keyboard-style:
- **7 per-degree switches**, one per scale degree, each showing the **note name** (in the current tonic, e.g. C D E F G A B) + its **current accidental glyph** (♭ / half-flat `د` style `½♭` / natural), and **lit/raised when non-natural**.
- **Click cycles** that degree through its available mandal positions (our existing `cycleMandal`); degrees 3 and 7 are the workhorses, visually findable.
- **Maqam preset chips** (Rast, Bayati, Hijaz, Nahawand, Kurd, Nikriz, Saba, Suznak): one tap sets the whole pattern (`MAQAM_PRESETS`). A **reset** chip returns to the default (Rast/natural).
- **Mouse-first and reliable.** The vertical-flick hand gesture is **kept as a secondary convenience** (improved hysteresis) but is no longer the primary or only path.

## 2. Mouse / pointer control (play without a webcam)

- **Click a string** = pluck it.
- **Click-drag across strings** = glide / rake (each crossed course sounds).
- **Click-and-hold** = sustain the note (rashsh tremolo, see §3).
- The modulation panel, presets, and all controls are clickable.
This makes the instrument fully playable with a mouse/trackpad, and reliable for modulation, while the webcam hand-tracking remains for expressive touchless play.

## 3. Sound: sustain via triple-course shimmer + rashsh (fix "too plucky")

**Why.** The qanun is a plucked zither with ~1.5–2 s natural decay. Players sustain a line with **rashsh** — rapid down/up tremolo picking (~6–10 Hz) — and every note blooms because each course is **3 unison strings slightly detuned**, giving a built-in chorus/shimmer. (Sources: Sawa, *A Treatise on Qanun Musical Ornaments*, ch. 3 on rashsh; arabinstruments.com; salamuzik.com triple-course description; 8Dio Qanun technique list.)

**Decision — audio engine v2** (applies to BOTH the synth fallback and the future sampler):
- **Triple-course voice:** each note triggers **3 voices detuned ±~4 cents**, decaying at slightly different rates → bloom/shimmer; perceived sustain.
- **Natural decay ~1.5–2 s** (not the current short pluck), softened release.
- **Body reverb** on by default (subtle), for resonance.
- **Sustain / hold:** while a note is held (mouse-hold or a sustained pinch), **re-trigger at ~7 Hz** (rashsh) with a gently varying velocity, instead of faking an envelope.
- Keep the `pluck()` interface; add `sustainStart/Stop` (or a `hold` flag) for rashsh.

## 4. Trill (upper-neighbor burst)

**Why.** The Arabic qanun trill alternates rapidly with the **upper diatonic neighbor** (the next scale degree up in the active maqam) as a **finite ornamental burst** (~7 Hz, a few cycles, then resolve), not a sustained tremolo. (Sources: violinonline.com Arabic ornament unit; organology/qanun ornament descriptions; Sawa treatise.)

**Decision.**
- **Primary UX: a "trill" ornament toggle** (off by default). When on, each plucked note plays a short **upper-neighbor trill burst** (~7 Hz, ~5 cycles) then settles on the principal note. Identical on hand-pinch and mouse — no new gesture to learn, fully reliable.
- **Also emerges naturally** from §3 sustain: holding a note and alternating to the neighbor produces a live trill.
- **Optional gesture** (later/if wanted): a short **horizontal shake** in the play zone (distinct from the directional rake sweep). Not the primary path.

## 5. Remaining phases (unchanged intent, now scheduled)

- **P2 — real sound:** wire `Tone.Sampler` with a **license-clear** qanun multisample behind the v2 voice (triple-course + rashsh reused); synth stays as fallback. (Sourcing in `docs/research/qanun-samples.md`; only CC0/CC-BY/public-domain or user-supplied audio ships.)
- **P3 — sayr & guided modulation:** per-maqam sayr networks (catalog), weighted `suggestModulations` panel (the preset chips become sayr-ordered), emphasis-note overlay on the field.
- **P4 — studio extras:** WAV recording, drone, metronome, microtonal MIDI (MPE pitch-bend).
- **P5 — polish:** onboarding, light/dark, responsive, performance pass.
