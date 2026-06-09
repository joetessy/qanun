# Sayr & Modulation Reference (engine model)

> Distilled from *Inside Arabic Music* (Farraj & Abu Shumays, OUP 2019), **chapters 13, 16, 17, 18, 19, 20**, by research agents during design. Companion files: per-maqam data in [`maqam-sayr-catalog.md`](./maqam-sayr-catalog.md); jins intervals in [`ajnas-reference.md`](./ajnas-reference.md). Page numbers are the printed book.

This is the model that turns "which modulations are *reachable*" into "which are *idiomatic, and in what order*" — i.e. the sayr.

---

## 1. What sayr is (and why scale ≠ maqam)

**Sayr** ("course/motion," pp. 314–316) = a maqam's habitual melodic behavior: its pathways, emphasis notes, expected modulations, intonation, and phrasing. Two maqamat can share the **same scale** yet differ entirely by sayr (e.g. ʿAjam vs ʿAjam ʿUshayran: same notes, but ghammāz on the 5th vs the 3rd, different secondary ajnas and direction, p. 315). **Therefore a maqam is identified by ghammāz position + secondary ajnas + pathways + direction — not by its interval set alone.**

Hierarchy (p. 315): **jins** (smallest melodic area, one tonicized note) → **modulation** (motion from one jins to the next) → **sayr** (the large-scale sequence of modulations) → **maqam** (a network built from multiple sayr-s).

## 2. The sayr network (THE data model — pp. 280–281, 324–328)

The authors model a maqam as a **weighted directed network**. This drops straight into code.

- **Node = a jins instantiated at a scale degree**, labeled `"<Jins> <degree>"` (e.g. `Rast 1`, `Nahawand 5`, `Upper Rast 5/8`, `Rast 4 LO`). `5/8` = fragment starts on degree 5, tonic on 8. `LO` = lower octave. The **octave instance of a jins is a distinct node** from its root instance (higher energy, p. 320).
- **Edge = a sanctioned modulation** between two nodes. Edges carry a **weight = traffic** ("thicker = more heavily trafficked," p. 283) and an **observed flag** (solid = corpus-attested; dashed = exists in the tradition but not in the sampled songs, pp. 280–281).
- **Start/end flags:** rounded node = a valid **starting** region; filled/black node = an **ending/cadence (qafla)** region (p. 327). The tonic root jins is usually the unique end.
- **A sayr = a weighted *subnetwork*** with a start region (may NOT be the bottom jins) and an end region (usually the tonic), traversed as a loose weighted walk that allows back-and-forth, variation, and interpolation — not a fixed path (pp. 326, 330).
- **Interpolation** (p. 328): inserting a sanctioned detour `A → C → B` on an existing edge `A→B`; only on edges the network allows.
- **Sayr of a jins** (p. 329): each jins has a small local subnetwork of its most common immediate neighbors; expand it when the player *dwells* on a jins, ignore it when merely passing through.

Quantified example — **Maqam Rast network** (pp. 280–281): `Rast 1` is the main hub (8 connections); `Nahawand 5` (7) and `Hijaz 5` (7) nearly as central; `Upper Rast 5/8` is *traditionally over-ranked* (only 5). → trust traffic data, not folklore, for edge weights.

### Node/edge schema for the engine
```
JinsRegion {            // a node
  jins, degree, label, octaveContext: root|octave|lowerOctave,
  width: 3|4|5,         // jins size, for drawing
  role: TONIC|GHAMMAZ|OCTAVE|LEADING_TONE|REST_TONE|OTHER,
  emphasisWeight,       // how strongly to dwell (tonic & ghammaz highest)
  isStart, isEnd        // rounded / black
}
Transition { from, to, weight, observed }   // an edge
Sayr { type: ascending|descending|octave-start, startRegion, endRegion, nodes[], edges[] }
Maqam { id, scale, rootJins, ghammazDegree, nodes[], edges[], sayrs[], family, qafla }
```

## 3. Notes of melodic emphasis (pp. 320–322) — what to highlight on the field

A sayr "touches specific notes in a specific order, like a mail-truck route" (p. 320). The emphasis notes:

| Note | Role | Engine treatment |
|---|---|---|
| **Tonic (qarar)** | the note melodies resolve to for closure (p. 195) | highest resolution weight; cadence target; highlight strongly |
| **Ghammāz** | top of the root jins / start of the next; **primary modulation hub** + 2nd-most-emphasized note (p. 321) | mark as the main transition source; highlight |
| **Octave** | milestone/peak; maqam "not fully realized" without it (p. 320) | climax node; distinct from root |
| **Leading tone (al-hassās)** | note just below the tonic; per-jins interval (not always a half-step); opens phrases — a jins is recognizable from leading-tone→tonic alone (p. 195) | directional cue into the tonic |
| **Rest tones (ʿatabāt)** | "steps/thresholds" that break the ascent into stages; Rast ascends tonic→3→4→5→octave (p. 321) | the ordered staircase of the sayr |

**The 5 ways emphasis is physically applied (p. 321)** — for a qanun specifically: play it **more often**, **longer**, **louder**, **octave-double/alternate**, or **tremolo/drone (*rashsh*)**. → an emphasis node maps to `{repetitionRate, durationBias, velocityBias, octaveDoubling, droneTremolo}`. v1 uses these mainly to *visually* highlight the emphasis notes and to drone the tonic.

## 4. The two modulation techniques (p. 300) → how they map to the qanun

1. **Alter the intervals** (same tonic; change a note above it → new jins). *Unambiguous.* As little as one quarter-tone flip suffices (e.g. Nahawand→Rast by raising the 3rd; Bayati↔Hijaz). **→ This is exactly what flipping a mandal does.** The mandal rack *is* technique 1.
2. **Change the tonic** (tonicize a higher degree, usually the ghammāz). *Ambiguous* — depends on the ear feeling a new resolution. **→ Out of scope for this instrument.** Shifting the tonal centre is left to the player's melody; we do not detect or handle it. (The emphasis overlay merely *shows* where the ghammāz and tonic are, as a playing aid.)

**Tonicization vs accidental (pp. 301–302, 305) — the gate for "did a modulation happen":** emphasizing a note ≠ tonicizing it. A brief foreign note = a **hint/ornament**; a foreign note **held for a whole phrase and resolved to** = a **modulation**. "Rely on the ear's sense of resolution" (p. 302). **This instrument implements technique 1 only:** mandal state defines the available jins; technique-2 tonicization is out of scope (no detection, no special handling).

**Mid-jins switch** (p. 303): switch between two ajnas sharing the *same tonic and ghammāz* (e.g. Hijaz↔Bayati on D, switching the 3rd F♯↔F) — best rendered with a glide on the differing string.

## 5. Jins pairs (p. 306) — the cheapest swaps (first-class quick-swaps)

Single-accidental swaps; wherever the left jins appears, the right can substitute:

| Common | ↔ | Variant | Transform |
|---|---|---|---|
| Bayati | ↔ | Saba | lower the 4th |
| Nahawand | ↔ | Nahawand Murassaʿ | lower the 5th |
| Sikah | ↔ | Mukhalif Sharqi | lower the 3rd |
| Rast | ↔ | Sazkar | raise the 2nd |
| Hijaz | ↔ | Hijazkar | raise the 7th below the tonic |

**Deliberately NOT a fluid pair:** Nahawand↔Nikriz (raise the 4th) — same one-note mechanism, but idiomatically a "dramatic contrast," not a fluid swap (except on the 4th of Maqam Hijaz). The engine must encode this asymmetry.

**Overlapping-ajnas pivots (p. 304)** — tonicize a shared region with no interval change: **Rast → Sikah on the 3rd** (Rast 3-4-5 = Sikah 1-2-3); **Saba Dalanshin → Hijaz** on the same tonic.

## 6. Chaining ajnas → maqam (p. 288) & family ranking

Maqam = lower jins (tonic on degree 1) + upper jins **starting on the lower jins's ghammāz** (overlap by one note); a 3rd jins, if any, starts on the 2nd's ghammāz. Maqamat are grouped into **families by shared root jins** (8 of the 9 common ajnas head a family; Saba names only one maqam).

**Rank modulation suggestions by idiomaticity (engine rule):**
1. **Cheapest:** change the *upper* jins, keep root jins + tonic (same family) — Rast→Suznak (Hijaz on 5), Bayati→Bayati Shuri.
2. Same tonic, new root jins but shared ghammāz/common tones — Rast↔Nahawand, Bayati→Saba.
3. New tonic via the current jins's ghammāz; then via a secondary jins (more dramatic).
- Seed each maqam's candidate set from its **sayr network** (the catalog), and allow secondary→secondary moves *without* first returning to the tonic (p. 273).

## 7. How this maps to the qanun (design summary)

- **Mandals = technique 1.** Flipping the 7 degree-mandals alters intervals → changes the jins. **Jins-pair swaps are single-mandal flips** and become the headline quick-swap suggestions.
- **Emphasis overlay.** Highlight the current maqam's emphasis notes on the string field (tonic, ghammāz, octave, leading tone, the ʿatabāt staircase) to guide the player along the sayr. Optionally drone/tremolo the tonic.
- **Sayr guide (the upgraded "idiomatic jumps").** From the current jins, surface the outgoing edges of the maqam's sayr network — the idiomatic next modulations, ordered by edge weight, jins-pair swaps flagged, the qafla (cadence) hinted. This is "the space within the modulation."
- **Technique 2 (tonicization) is not implemented.** Shifting the tonal centre is left to the player's melodic choices; the emphasis overlay simply helps them hear where home and the ghammāz are.
- Per-maqam network data is seeded from [`maqam-sayr-catalog.md`](./maqam-sayr-catalog.md).
