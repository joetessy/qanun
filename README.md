# Qanun

An interactive web **qanun** — the Arabic plucked box-zither — played with your **mouse** or your **hands over a webcam**. Authentic maqam tuning (quarter-tones, scale-locked strings), real sampled kanun sound, free modulation between ajnas via an Oriental-keyboard-style mandal panel, and a photoreal wood-and-brass interface.

Built on React 19 + TypeScript + Vite, Tone.js, and MediaPipe hand-tracking.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Click a string to pluck (drag to glide, hold to sustain), or press **play** to use your hands. Modulate by picking a **lower jins** (chips or keys `Q`–`O`) and an **upper jins** (`1`–`5`); the mandal switches give per-degree control. See [How modulation works](#how-modulation-works). The first-run guide (and the **?** button) explains the rest.

```bash
npm run test:run   # 295 tests
npm run build      # production build → dist/
```

## How modulation works

A **maqam** on this qanun is defined by two overlapping building blocks called *ajnas* (singular: *jins*):

- **Lower jins** — the foundational 4–5-note cell that sits on the tonic, giving the maqam its characteristic color. Rast, Bayati, Hijaz, Nahawand, Kurd, Nikriz, ʿAjam, Saba, and Sikah are the nine available families, mapped to the letter keys **Q W E R T Y U I O**.
- **Upper jins** — a complementary cell starting on the *ghammāz* (the natural pivot ~a fifth up). Keys **1–5** cycle through the options that make musical sense for the current lower jins.

### Picking a lower jins re-anchors the home tonic

Each jins has a conventional home degree — the scale degree its tonic naturally sits on:

- **Rast → degree 1** (home on C when tonic = C)
- **Bayati → degree 2** (home on D)
- **Sikah → degree 3** (home on E½)

When you switch lower jins, the **highlighted home strings** move to reflect the new tonic. Some switches are "free" — **Rast → Bayati → Sikah** are all *modes of the same Rast scale*, so the string tuning stays identical and only the highlighted home shifts. Others (Nahawand, Hijaz, Kurd, Nikriz, ʿAjam, Saba) actually retune the affected courses.

### Combining lower + upper jins names the maqam

- **Rast lower + Rast upper** = Maqam Rast
- **Rast lower + Hijaz upper** = Maqam Suznak
- **Sikah lower + Hijaz upper** = Maqam Huzam
- **Bayati lower + Rast upper** = Maqam Bayati

The HUD readout shows the inferred maqam name and the home note, e.g. **"Maqam Bayati · home d"**.

### Fine-tuning

- The **per-degree mandal panel** (left rack) lets you raise or lower individual degrees by a semitone or quarter-tone for manual fine-tuning.
- The **tonic control** in the drawer (the "tune" button) sets the key — moving "C / Rast" up or down in pitch.
- The **jins-pair quick-swaps** in the drawer apply common modulation moves in one tap.

## Docs

- **[docs/HANDOFF.md](docs/HANDOFF.md)** — current state, how to play, architecture, module map, caveats. **Start here.**
- [docs/MUSIC-THEORY.md](docs/MUSIC-THEORY.md) — the maqam/jins/sayr knowledge base.
- `docs/superpowers/specs/` — the design specs (v1 + the v2 interaction/sound rework).
- `docs/research/` — ajnas/sayr references and sample-sourcing notes.

## Sound credits

Sampled from a **CC0 / public-domain** Turkish-kanun recording (Bozkurt, Freesound #211133); see [public/samples/qanun/NOTICE.md](public/samples/qanun/NOTICE.md). A Karplus-Strong synth voice is the fallback.
