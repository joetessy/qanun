# Arabic Ajnas Reference (for the qanun music engine)

> Compiled from **maqamworld.com** (Johnny Farraj) and **maqamlessons.com** (Sami Abu Shumays),
> the two sources the user cited. Interval data extracted from maqamworld's notation and
> cross-checked against maqamlessons' relative-pitch descriptions. Convention: semitones from
> the jins tonic, equal-tempered, **half-flat = −0.5**, **half-sharp = +0.5**. This file backs
> the modulation system; preserved here during brainstorming and folded into the spec.

## Data model (the key insight)

- A **jins** = `{ intervals[], tonicPc, ghammazDegree(s) }`. Trichord (3) / tetrachord (4) /
  pentachord (5) — the size is defined by **where the ghammāz sits** (its top note).
- A **maqam** = an ordered chain of 2–3 ajnas: `[(jinsId, startDegree), ...]`. The lower jins
  sits on the tonic; each **upper jins starts on the previous jins's ghammāz** (overlap by one
  shared note). 4-note jins → upper starts on degree 4; 5-note → degree 5; 3-note → degree 3.
- **Modulation = swapping/pivoting the jins** on a shared note. Pivot strength heuristic:
  1. **ghammāz** (4th/5th degree) — strongest, the next jins's tonic lands here by definition.
  2. **tonic** recolour (Rast↔Nahawand, Bayati↔Kurd↔Saba).
  3. **neutral third E♭½** (Rast↔Sikah).
  - One-accidental neighbours (Bayati↔Kurd, Saba↔Saba Zamzam, Nikriz↔Athar Kurd) are the
    cheapest modulations.
- **Sayr** (melodic course / which secondary ajnas are visited, in what order) is learned
  convention, NOT derivable from the scale. Allow a 1–2 note "halo" beyond the textbook jins
  span before registering a modulation (a modulation is a clear re-tonicization on a new degree).

## Interval cheat-sheet (drop-in)

```
Rast        [0, 2, 3.5, 5, 7]      ghammaz 5 (G)            C
Nahawand    [0, 2, 3, 5, 7]        ghammaz 5 (G)            C
Ajam(5)     [0, 2, 4, 5, 7]        ghammaz 5 (G)            C   (maqam usually on Bb)
Ajam(3)     [0, 2, 4]              secondary jins           Bb  (on 6th of Bayati/Saba/Kurd)
Bayati      [0, 1.5, 3, 5]         ghammaz 4 (G)            D
Kurd        [0, 1, 3, 5]           ghammaz 4 (G)            D
Hijaz       [0, 1, 4, 5]           ghammaz 4 (G)            D   (2nd raised/3rd lowered acoustically)
Saba        [0, 1.5, 3, 4]         ghammaz 3 (F) & 6 (Bb)   D
Sikah       [0, 1.5, 3.5]          ghammaz 3 (G)            E half-flat
Nikriz      [0, 2, 3, 6, 7]        ghammaz 5 (G)            C
Athar Kurd  [0, 1, 3, 6, 7]        ghammaz 5 (G)            C
Mustaar     [0, 2.5, 3.5]          ghammaz 3 (G)            E half-flat
Lami        [0, 1, 3, 5]           ghammaz 4 (G)            D   (= Kurd shape, different sayr)
Saba Zamzam [0, 1, 3, 4]           ghammaz 3 (F) & 6 (Bb)   D
Hijazkar    [0, 1, 4, 5]           no ghammaz               C   (Hijaz both sides)
Jiharkah    [0, 2, 4, 5, 7]        ghammaz 5 (C)            F   (3rd/4th played slightly flat)
Sazkar      [0, 3, 3.5, 5, 7]      ghammaz 5 (G)            C
Upper Rast  [0, 2, 3.5, 5]         tonic on top            C   (sits G→C)
Upper Ajam  [0, 2, 4, 5]           tonic on top            C   (sits G→C)
Hijaz Mur.  [0, 1, 4, 5]           ghammaz 4 (G)            D   (modulation only)
Ajam Mur.   [0, 2, 4, 6, 7]        ghammaz 5 (C)            F   (modulation only)
Nahawand Mur[0, 2, 3, 5, 6]        no ghammaz               C
Saba Dalan. [0, 1, 4, 5]           no ghammaz               C   (A below = secondary tonic)
Mukhalif    [0, 1.5, 2.5]          no ghammaz               E half-flat
Sikah Baladi  EAR-TUNED (komas) — do NOT hard-code 24-EDO   G
```

## Common modulation map (qanun-practical)

**Rast family (tonic C):**
- Rast@1 → Nahawand@5 (G) — swap upper pentachord onto G. Pivot **G**.
- Rast@1 → Hijaz@5 (G), usually via Nahawand@5 first (→ Suznak feel). Pivot **G**.
- Rast@1 ↔ Sikah@3 (E♭½) — share the neutral third; the signature Rast pivot. Pivot **E♭½**.
- Rast@1 → Bayati/Saba@5 (G) — degrees 5-6-7 shared, ambiguous ornamentation. Pivot **G**.
- Rast@1 → Jiharkah@8 (C′) at the octave. Pivot **C′**.
- Rast@1 ↔ Nahawand@1 (C) — same tonic, major↔minor third recolour. Pivot **C**.

**Bayati family (tonic D):**
- Bayati@1 → Nahawand@4 / Hijaz@4 (G) — Hijaz 4 typically via Nahawand 4. Pivot **G**.
- Bayati@1 → Rast@4 (G) — ubiquitous in mawwāl/improv. Pivot **G**.
- Bayati@1 → ʿAjam@6 (B♭) — the 3-note Ajam on the 6th. Pivot **B♭**.
- Bayati@1 ↔ Saba@1 (D) — share D-E♭½-F; lower the 4th (G→G♭). Pivot **D**.
- Bayati@1 ↔ Kurd@1 (D) — recolour the 2nd (E♭½ ↔ E♭). Pivot **D**.

**Nahawand / Kurd / Hijaz:**
- Nahawand@1 → Hijaz@5 / Kurd@5 (G). Pivot **G**.
- Kurd@1 → Nahawand@4 (G); → ʿAjam@6 (B♭).
- Hijaz@1 → Nahawand@4 / Rast@4 (G). Hijaz also appears as the upper jins on Rast/Bayati/Nahawand ghammāz.
- Nahawand is the universal minor "glue" (4th of Bayati/Hijaz/Kurd; 5th of Rast/Hijaz/Nikriz) — default neutral pivot.

**Saba / Sikah / Nikriz:**
- Saba@1 → Hijaz@3 (F) → ʿAjam/Nikriz@6 (B♭). Pivots **F**, **B♭**.
- Sikah@1 ↔ Rast on E♭½; → Huzam (Hijaz on 3rd), → Mukhalif (lower 3rd), → Mustaʿar (raise 2nd).
- Nikriz@1 → Nahawand@5 (G); Nikriz ↔ Nawa Athar (same pitch set, different role).

## Maqam construction (verified examples)

| Maqam | Construction |
|---|---|
| Rast | Rast@1 (C) + Upper Rast or Nahawand @5 (G) |
| Suznak | Rast@1 (C) + Hijaz @5 (G) |
| Nahawand | Nahawand@1 (C) + Hijaz or Kurd @5 (G) |
| Kurd | Kurd@1 (D) + Nahawand @4 (G) |
| Bayati | Bayati@1 (D) + Nahawand or Rast @4 (G) |
| Hijaz | Hijaz@1 (D) + Nahawand or Rast @4 (G) |
| Saba | Saba@1 (D) + Hijaz @3 (F) + ʿAjam or Nikriz @6 (B♭) |
| Sikah | Sikah@1 (E♭½) + Upper Rast @3 + Rast @6 |
| Nikriz | Nikriz@1 (C) + Nahawand @5 (G) |
| ʿAjam | ʿAjam@1 (C/B♭) + Upper ʿAjam or Nahawand @5 (G) |
| Athar Kurd | Athar Kurd@1 (C) + upper jins @5 (G) |

## Intonation / special-case flags

1. **Lami = Kurd** intervals `[0,1,3,5]`; distinguished only by sayr. Don't expect a separate vector.
2. **Hijaz** notated `[0,1,4,5]` but acoustically the 2nd is raised ~25–50¢ and 3rd lowered ~25–50¢
   (narrower than a literal augmented 2nd). Relevant only if we support fine cents tuning.
3. **Saba / Saba Zamzam** have an ambiguous size and **two ghammāz** (F and B♭) — model as a set.
4. **Sikah Baladi** is comma/ear-tuned — do NOT assign equal-tempered integers; flag for custom cents.
5. **ʿAjam**: 5-note `[0,2,4,5,7]` is primary; 3-note `[0,2,4]` on B♭ is a secondary jins on the 6th.
