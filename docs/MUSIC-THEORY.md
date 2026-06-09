# Qanun Music Theory — Knowledge Base

> The canonical, self-contained music-theory reference for the interactive web qanun. It carries the **model and the data the engine needs**; exhaustive detail lives in the companion files. Keep working from this doc.
>
> **Sources:** maqamworld.com & maqamlessons.com (Johnny Farraj & Sami Abu Shumays) and their book *Inside Arabic Music* (OUP 2019) — chapters 13–20 (jins, maqam, modulation, sayr) and chapter 24 (Maqam Index).
>
> **Companion files (depth):**
> - [`research/ajnas-reference.md`](research/ajnas-reference.md) — every jins's intervals, tonic, ghammāz, + the common modulation map.
> - [`research/sayr-reference.md`](research/sayr-reference.md) — the sayr/modulation engine model (chs 13–20).
> - [`research/maqam-sayr-catalog.md`](research/maqam-sayr-catalog.md) — per-maqam sayr pathways (ch 24).

---

## 1. The hierarchy

**note → jins → maqam → modulation → sayr**

- **Jins** (pl. *ajnas*): a 3–5-note melodic cell with one tonicized note — the atom of Arabic melody.
- **Maqam**: a scale *and* a set of behaviors, built by chaining ajnas.
- **Modulation**: moving from one jins to the next.
- **Sayr**: a maqam's habitual large-scale melodic pathway — its expected sequence of modulations, emphasis notes, intonation, and phrasing. **Two maqamat with the same scale can differ entirely by sayr.**

## 2. Pitch convention

Semitones from a reference, with **quarter-tones as half-integers**: **half-flat = −0.5**, half-sharp = +0.5 relative to the natural. A "half-flat 3rd" above C (the *sīkāh* pitch, E half-flat) = `3.5`. The instrument is **24-EDO** (quarter-tones); no finer commas in v1.

## 3. Jins — the building block

- **Tonic (*qarar*)**: the note the melody resolves to for closure.
- **Ghammāz**: the top of the jins / where the next jins begins — the **primary modulation point** and the 2nd-most-emphasized note. Sits on the **3rd** (trichord), **4th** (tetrachord), or **5th** (pentachord) degree.
- **Leading tone (*al-hassās*)**: the note just below the tonic; a per-jins interval (not always a semitone). A jins is recognizable from leading-tone → tonic alone.

### Jins interval cheat-sheet (drop-in for code; full notes in `ajnas-reference.md`)

```
Jins         Intervals (semitones)   Ghammāz       Std tonic
Rast         [0, 2, 3.5, 5, 7]       5 (G)         C
Nahawand     [0, 2, 3, 5, 7]         5 (G)         C
Ajam (5)     [0, 2, 4, 5, 7]         5 (G)         C   (maqam usually on Bb)
Ajam (3)     [0, 2, 4]               secondary     Bb
Bayati       [0, 1.5, 3, 5]          4 (G)         D
Kurd         [0, 1, 3, 5]            4 (G)         D
Hijaz        [0, 1, 4, 5]            4 (G)         D
Saba         [0, 1.5, 3, 4]          3 (F) & 6     D
Sikah        [0, 1.5, 3.5]           3 (G)         E half-flat
Nikriz       [0, 2, 3, 6, 7]         5 (G)         C
Athar Kurd   [0, 1, 3, 6, 7]         5 (G)         C
Mustaʿar     [0, 2.5, 3.5]           3 (G)         E half-flat
Lami         [0, 1, 3, 5]            4 (G)         D   (= Kurd shape, diff. sayr)
Saba Zamzam  [0, 1, 3, 4]            3 (F) & 6     D
Hijazkar     [0, 1, 4, 5]            none          C   (Hijaz both sides)
Jiharkah     [0, 2, 4, 5, 7]         5 (C)         F   (3rd/4th slightly flat)
Sazkar       [0, 3, 3.5, 5, 7]       5 (G)         C
Upper Rast   [0, 2, 3.5, 5]          tonic on top  C   (sits G→C)
Upper Ajam   [0, 2, 4, 5]            tonic on top  C   (sits G→C)
Nahawand Mur [0, 2, 3, 5, 6]         none          C
Saba Dalan.  [0, 1, 4, 5]            none          C   (A below = secondary tonic)
Mukhalif     [0, 1.5, 2.5]           none          E half-flat
Sikah Baladi  EAR-TUNED (komas) — do NOT hard-code 24-EDO   G
```
Intonation flags (only matter if we add fine-tuning): Hijaz's 2nd is acoustically a touch high and its 3rd a touch low; Sikah Baladi is comma-tuned (leave for custom cents). See `ajnas-reference.md`.

## 4. Maqam — chaining ajnas

- A maqam = **lower jins on the tonic (degree 1)** + **upper jins whose tonic sits on the lower jins's ghammāz** (they overlap by one shared note). A third jins, if present, starts on the second's ghammāz.
- Model: `maqam = [(jins, startDegree), …]`, where each upper jins's `startDegree` = the previous jins's ghammāz degree.
- **Families:** maqamat are grouped by shared **root (lower) jins**. Eight of the nine common ajnas head a family; **Saba** names only one maqam.

| Maqam | Construction |
|---|---|
| Rast | Rast @1 (C) + Nahawand / Upper Rast @5 (G) |
| Suznak | Rast @1 (C) + **Hijaz** @5 (G) |
| Nahawand | Nahawand @1 (C) + Hijaz / Kurd @5 (G) |
| Bayati | Bayati @1 (D) + Nahawand / Rast @4 (G) |
| Hijaz | Hijaz @1 (D) + Nahawand / Rast @4 (G) |
| Kurd | Kurd @1 (D) + Nahawand @4 (G) |
| Saba | Saba @1 (D) + Hijaz @3 (F) + ʿAjam/Nikriz @6 (Bb) |
| Sikah / Huzam | Sikah @1 (E½♭) + Hijaz @3 + Rast @6 |
| Nikriz | Nikriz @1 (C) + Nahawand @5 (G) |

## 5. The qanun tuning model (engine)

- **Not chromatic.** ~7 courses per octave (one per degree) × ~3.5 octaves ≈ **26 courses**. Scale-locked: a glide runs the current maqam.
- **Tonic** (user-selectable MIDI pitch, default **C**) + **7 degree-mandals**. Each mandal sets that degree's accidental (semitone offset from the tonic):

  | Degree | Positions (offset) | Default (Rast) |
  |---|---|---|
  | 1 (root) | fixed `0` | 0 |
  | 2 | flat `1` · half-flat `1.5` · natural `2` | 2 |
  | 3 | flat `3` · half-flat `3.5` · natural `4` | 3.5 |
  | 4 | dim `4` · natural `5` · raised `6` | 5 |
  | 5 | fixed `7` (pillar) | 7 |
  | 6 | flat `8` · half-flat `8.5` · natural `9` | 9 |
  | 7 | flat `10` · half-flat `10.5` · natural `11` | 10.5 |

  Degrees 1 & 5 are fixed pillars in v1. Degree-4 *dim* (4) = Saba's lowered 4th; *raised* (6) = Nikriz/Hijaz augmented 4th. Refine the position sets against the cheat-sheet so every jins is reachable.
- **`buildField(tonicMidi, mandalState) → Course[]`** lays the scale-locked field: for octave `o`, degree `d`: `pitchMidi = tonicMidi + 12*o + offset(d, mandalState[d])`.
- **`identifyAjnas(mandalState) → {lower, upper, maqamName}`** reads the mandal state and names what's tuned.

## 6. Modulation = mandals (technique 1 only)

*Inside Arabic Music* names two techniques: (1) **alter intervals** on the same tonic; (2) **tonicize a new degree**. **This instrument implements only technique 1 — flipping mandals.** Technique 2 (moving the tonal centre) is left entirely to the player's melody; **no detection, no special handling.** Mental model: *the mandals are the modulation.*

### Jins pairs — the cheapest swaps (single mandal flip; first-class suggestions)
| Common | ↔ | Variant | Transform |
|---|---|---|---|
| Bayati | ↔ | Saba | lower the 4th |
| Nahawand | ↔ | Nahawand Murassaʿ | lower the 5th |
| Sikah | ↔ | Mukhalif Sharqi | lower the 3rd |
| Rast | ↔ | Sazkar | raise the 2nd |
| Hijaz | ↔ | Hijazkar | raise the 7th below the tonic |

**Nahawand ↔ Nikriz is deliberately NOT a fluid pair** (same one-note mechanism, but idiomatically a dramatic contrast).

**Overlapping-ajnas pivots** (same notes, re-centered): Rast → Sikah on the 3rd; Saba Dalanshin → Hijaz on the same tonic.

### Suggestions
`suggestModulations(mandalState, tonic)` → idiomatic next moves as **mandal presets**, ordered by sayr traffic (from the per-maqam networks), tagged by relationship (jins-pair / same-family upper-jins change / shared-ghammāz neighbour). Selecting one flips the relevant mandals. Ranking heuristic: (1) change the upper jins, keep root+tonic (same family — cheapest); (2) same tonic, new root jins, shared ghammāz; (3) new tonic via the ghammāz.

## 7. Sayr — the melodic pathway (guidance only)

- **Scale ≠ maqam.** Identity = **ghammāz position + secondary ajnas + pathways + direction**, not the interval set alone.
- **Network model.** Each maqam = a **weighted directed graph**: nodes = `jins@degree` (carry an emphasis weight + start/cadence flags), edges = idiomatic modulations weighted by how heavily trafficked they are (solid = attested, dashed = exists-elsewhere). A *sayr* is a weighted subnetwork with a start region (not necessarily the bottom jins) and an end region (usually the tonic), traversed loosely (back-and-forth, interpolation). Per-maqam data: `maqam-sayr-catalog.md`.
- **Notes of melodic emphasis** (highlight on the field): **tonic (qarar)**, **ghammāz** (hub), **octave** (peak/milestone), **leading tone**, and the **ʿatabāt** — the ordered rest-steps of the ascent (e.g. Rast ascends tonic → 3rd → 4th → 5th → octave).
- **Qanun emphasis techniques** (how a node's "weight" is applied): play more often / longer / louder / octave-double / tremolo (*rashsh*). v1 uses these mainly to *visually* highlight emphasis notes (+ optional tonic drone).
- **Cadence (qafla).** Every maqam has a concluding descent to the tonic (the "trunk"). For the Rast family, **Nahawand 5 → Rast 1 is near-mandatory**; Upper Rast / Hijaz are optional within it.

### Example sayr (Maqam Rast, from the catalog)
Start on root Jins Rast (C) → develop around the **ghammāz on 5 (G)**: Nahawand 5, **Hijaz 5 (= Suznak, near-obligatory)**, Bayati 5 (= Nairuz), Saba 5 → reach the octave region (Rast 8, Nahawand 8) → cadence back down via **Nahawand 5 → Rast 1**. Secondary colors: Sikah/Mustaʿar on 3, Nikriz on 1, Saba Dalanshin at the octave.

## 8. How the theory maps to the instrument (summary)

| Theory | Instrument surface |
|---|---|
| Technique 1 (alter intervals) | **The mandal rack** — flipping mandals *is* modulation. |
| Jins pairs | Headline single-flip **quick-swap** suggestions. |
| Sayr network | **Sayr guide** — ordered idiomatic mandal presets. |
| Notes of emphasis | **Emphasis overlay** (optional, off by default) — glow tonic/ghammāz/etc. on the strings. |
| Technique 2 (tonicization) | **Not implemented** — left to the player's melody. |

**Guiding principle:** simplest UX, possibilities intact. Depth (this whole doc) lives under the hood; the surface stays minimal.

## 9. The nine common ajnas → maqam families (quick map)

Rast, Nahawand, ʿAjam, Bayati, Hijaz, Kurd, Nikriz, Sikah each head a family; **Saba** heads only Maqam Saba. Family = all maqamat sharing that root jins, differing by their upper jins and sayr. Catalog families: Rast (Rast, Suznak, Nairuz, Kirdan/Sazkar, Dalanshin, Suzdalara, Mahur), Bayati (Bayati, Bayati Shuri, Husayni), Sikah (Huzam/Rahat al-Arwah, Sikah, ʿIraq, Bastanikar, Awj ʿIraq, Mustaʿar), Hijaz (Hijaz, Hijazkar, Zanjaran), Nahawand (Nahawand, Nahawand Murassaʿ, ʿUshshaq Masri), Nikriz (Nikriz, Nawa Athar, Athar Kurd), Kurd (Kurd, Hijazkar Kurd), ʿAjam. Full pathways in `maqam-sayr-catalog.md`.
