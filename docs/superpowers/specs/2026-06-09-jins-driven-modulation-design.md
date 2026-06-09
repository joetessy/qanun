# Jins-Driven Modulation — Design

**Date:** 2026-06-09 · **Status:** approved (brainstorm) → implementation plan next.
**Supersedes:** the maqam-preset rail and the jins-pair quick-swaps (both removed).

## Problem

Modulation currently means "set the whole maqam, always rooted at the tonic C." Selecting Bayati reconfigures the qanun as Bayati-on-C. But idiomatically Bayati lives on **D** (the 2nd of Rast-C), Sikah on **E½** (the 3rd), etc. We want the player to pick a **lower jins** and an **upper jins**; the app anchors the lower jins at its conventional **home degree** (moving the highlighted tonic, *not* transposing the strings), modulates the upper jins on the lower jins's **ghammāz**, and **infers + displays** the maqam.

## Model

- The field stays **C-anchored**: degree-1 is the key's reference pitch (the existing tonic control now sets the **key**). The 7 courses per octave (C D E F G A B) are tuned by `mandalState` — 7 semitone offsets from C.
- Each **lower jins** has a **home degree** (1–3) and a **default scale** (7 offsets). Selecting it loads the scale and moves the **home highlight** to its degree.
  - Lower jins that are **modes of Rast** (Bayati → degree 2, Sikah → degree 3) use the **Rast collection**, so switching from Rast changes **no notes** — only the home moves. (This is exactly the user's "Bayati just re-anchors to D" requirement.)
  - **Same-degree recolors** (Nahawand, Nikriz, Hijaz, ʿAjam on degree 1; Saba on 2 with its lowered 4th) **retune** the affected courses.
- Selecting an **upper jins** re-tunes only the courses on/above the lower jins's **ghammāz** (ghammāz field-degree = `homeDegree + lowerJins.ghammazDegree − 1`, capped at degree 7), leaving the lower tetrachord + home fixed.
- **Maqam name = lookup(lowerJins, upperJins)** (via the existing `MAQAM_NAMES`), shown with the **home note** — e.g. "Maqam Bayati · D".
- The field **extends an octave below the home** so the sub-tonic / leading tones and lower-register phrases are playable.

## Data — home degree + default scale (offsets from C)

| Lower jins | Home | Default scale | From Rast: |
|---|---|---|---|
| rast | C (1) | `0 2 3.5 5 7 9 10.5` | — |
| nahawand | C (1) | `0 2 3 5 7 8 10` | retune (minor) |
| nikriz | C (1) | `0 2 3 6 7 9 10` | retune (E♭, F♯) |
| hijaz | C (1) | `0 1 4 5 7 8 10` | retune *(C per prior decision; convention often D)* |
| ajam | C (1) | `0 2 4 5 7 9 11` | retune (major) |
| **bayati** | **D (2)** | `0 2 3.5 5 7 9 10.5` | **no note change** (Rast collection, home→D) |
| kurd | D (2) | `0 2 3 5 7 9 10.5` | only E½→E♭ |
| saba | D (2) | `0 2 3.5 5 6 8 10` | retune (lowered 4th) |
| **sikah** | **E½ (3)** | `0 2 3.5 5 7 9 10.5` | **no note change** (Rast collection, home→E½) |

The highlighted upper option after a load = the upper jins read off the default scale (e.g. Bayati's default upper is Upper-Rast, preserving A/B½). **Upper options per lower jins** (key 1–4, first = default):

- rast → Upper Rast, Nahawand, Hijaz, Bayati
- nahawand → Kurd, Hijaz, Bayati
- hijaz → Rast, Nahawand, Bayati
- bayati → Upper Rast, Nahawand, Hijaz
- kurd → Nahawand, Rast
- nikriz → Nahawand
- saba → Hijaz, ʿAjam
- sikah → Hijaz (→ Huzam), Rast
- ajam → Upper ʿAjam, Nahawand

## Interaction

- **Lower-jins selector** (replaces the maqam rail): family chips; **letter-row keys** Q W E R T Y U I O in the listed order; each chip shows its key.
- **Upper-jins selector** (the existing `UpperJinsSwitcher`, now home-aware): chips; **keys 1–4**.
- **Keep**: the per-degree mandal panel (manual quarter-tone tweaks) and the tonic control (now the **key**).
- **Remove**: the Bayati↔Saba / Hijaz↔Hijazkar jins-pair quick-swaps (superseded).
- **HUD**: inferred maqam + home note.
- **README**: a "How it works" section explaining the lower/upper-jins model, tonic anchoring, and the keys.

## Modules

- `src/lib/music/sayr/lowerJins.ts` *(new)* — `LOWER_JINS` (id, label, homeDegree, defaultScale, upperOptions), `applyLowerJins(state, id) → { mandalState, homeDegree }`, `lowerJinsOptions()`. Pure.
- `src/lib/music/sayr/upperJins.ts` *(rework)* — `applyUpperJins(state, upperId, homeDegree, lowerId)` now places the upper on `homeDegree + lowerGhammaz − 1`; `upperOptions(lowerId, state, homeDegree)` returns the contextual chips + active flag + maqam-name label.
- `src/lib/music/buildField.ts` — start an octave below the reference so every home has its sub-tonic + lower register (extend `FIELD` bottom; keep ~3.5-octave span).
- `src/hooks/useQanunEngine.ts` — state `lowerJins`, `upperJins`, `homeDegree`; `setLowerJins(id)`, `setUpperJins(id)`; expose `homeNote`, `maqamName` (from lookup), and the option lists; a keyboard handler (letter row → lower, 1–4 → upper).
- `src/components/LowerJinsSelector.tsx` *(new)*, `UpperJinsSwitcher.tsx` *(rework)*, `Controls.tsx` (drop jins-pairs), `Qanun.tsx` (wire + mount the keyboard handler), `QanunHud.tsx` (home note).
- `README.md` — add "How modulation works".

## Testing (TDD the pure pieces)

- `applyLowerJins`: Bayati from Rast → identical offsets + `homeDegree 2` (no note change); Nahawand → minor scale + `homeDegree 1`; Sikah → Rast collection + `homeDegree 3`; each id loads its table scale.
- `applyUpperJins` (home-aware): Bayati (home 2) + Nahawand → sets degrees 6–7 from the G ghammāz; Rast (home 1) + Hijaz → Suznak; ghammāz degree = `homeDegree + lowerGhammaz − 1`.
- maqam-name lookup returns the right name for (lower, upper) pairs incl. home-shifted ones; home-note formatting.
- `buildField` includes courses below the home (the octave-below sub-tonic).

## Out of scope

Turkish 53-koma tuning; per-jins micro-intonation; changing the fixed degree-1 anchor (the key control already transposes everything).
