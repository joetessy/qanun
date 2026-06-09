# Qanun

An interactive web **qanun** — the Arabic plucked box-zither — played with your **mouse** or your **hands over a webcam**. Authentic maqam tuning (quarter-tones, scale-locked strings), real sampled kanun sound, free modulation between ajnas via an Oriental-keyboard-style mandal panel, and a photoreal wood-and-brass interface.

Built on React 19 + TypeScript + Vite, Tone.js, and MediaPipe hand-tracking.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Click a string to pluck (drag to glide, hold to sustain), or press **play** to use your hands. Modulate with the mandal switches, the **upper-jins** switcher, or the one-tap **maqam presets**. The first-run guide (and the **?** button) explains the rest.

```bash
npm run test:run   # 297 tests
npm run build      # production build → dist/
```

## Docs

- **[docs/HANDOFF.md](docs/HANDOFF.md)** — current state, how to play, architecture, module map, caveats. **Start here.**
- [docs/MUSIC-THEORY.md](docs/MUSIC-THEORY.md) — the maqam/jins/sayr knowledge base.
- `docs/superpowers/specs/` — the design specs (v1 + the v2 interaction/sound rework).
- `docs/research/` — ajnas/sayr references and sample-sourcing notes.

## Sound credits

Sampled from a **CC0 / public-domain** Turkish-kanun recording (Bozkurt, Freesound #211133); see [public/samples/qanun/NOTICE.md](public/samples/qanun/NOTICE.md). A Karplus-Strong synth voice is the fallback.
