# Next-Session Prompt

Paste the block below into a fresh agent session started in `/Users/yusuf/Projects/qanun`.

---

I'm building an **interactive web qanun** — a browser instrument played with your hands over a webcam (MediaPipe hand tracking + Tone.js audio), built on the `../theremin` project as a foundation. The design is fully specced and the Arabic music theory is researched and compiled. **Nothing is built yet — this session writes the implementation plan and starts building.**

**Read these first, in order:**
1. `docs/superpowers/specs/2026-06-08-interactive-web-qanun-design.md` — the approved spec (the source of truth).
2. `docs/MUSIC-THEORY.md` — the consolidated music-theory knowledge base.
3. `docs/HANDOFF.md` — session handoff (decisions, repo state, open items).
4. Skim `docs/research/{ajnas-reference,sayr-reference,maqam-sayr-catalog}.md` for depth as needed.
5. Look at `../theremin/src` — reuse its vision (`lib/vision`, `lib/oneEuro`), audio (`lib/audio` FX/recorder), practice (`lib/practice`), MIDI (`lib/midi`), and React shell patterns. Reuse, don't reinvent.

**Non-negotiables (from the spec):**
- **Guiding principle — simplest UX, possibilities intact.** Zero-config start, progressive disclosure, passive guidance, one small gesture vocabulary (pinch = pluck, sweep = glissando, left-hand flick in the mandal zone = modulate), smart defaults. This **outranks feature-completeness**.
- **Modulation = the mandal rack, technique 1 ONLY.** Flipping mandals alters intervals = modulation. Do **not** model or detect "tonicizing a new degree" (technique 2) — leave that to the player's melody.
- **Scale-locked tuning** (never chromatic; a glide runs the maqam), quarter-tones (half-flat = .5 semitone), default Rast on C.
- **Sound:** `Tone.Sampler` qanun multisample (you'll need to source a license-clear set; present options before committing) with a Karplus-Strong synth fallback.
- **Photoreal visuals** via the `frontend-design` skill at implementation time.

**What to do this session:**
1. Use the **writing-plans** skill to produce a bite-sized, TDD, no-placeholders implementation plan for **Phase 1 — the core playable instrument** (vision loop, scale-locked string field + builder, nearest/snap, pinch-pluck, rake, the 7-lever mandal rack + flick, ajnas identifier + HUD readout, jins-pair quick-swaps, synth sound, photoreal shell, start/permission flow). Save it to `docs/superpowers/plans/`. P2–P5 (real samples; sayr networks + guide + emphasis overlay; recording/practice/MIDI; polish) get their own plans later.
2. The music model and gesture math are pure functions — make them the TDD core (transcribe the jins table and mandal positions from `MUSIC-THEORY.md`; test that every jins is reachable and `identifyAjnas` round-trips).
3. Then execute with **subagent-driven-development**, reviewing between tasks, using `frontend-design` for the UI.

Start by reading the spec and `MUSIC-THEORY.md`, then propose the Phase-1 plan.
