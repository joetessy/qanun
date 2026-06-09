# Qanun Multisample Sourcing — P2 Reference

> **Status:** research notes for **Phase 2** (real sampled sound). Phase 1 ships the Karplus-Strong synth fallback; this doc is the shortlist for wiring a `Tone.Sampler` later.
> **Compiled:** 2026-06-08 by a research agent (web-verified where noted). **Verify every license yourself before shipping** — provenance/licensing below is a starting point, not legal advice.
> **Engine fit:** `Tone.Sampler` pitch-shifts the nearest sample to any frequency, so **quarter-tones come free** — we need a chromatic-ish multisample (one note every 2–4 semitones across ~A2–E5), not pre-tuned microtonal files. The real qanun's 3-strings-per-course "trichord shimmer" is inherent in any genuine recording.

## Landscape

The qanun (kanun / qanoun) is niche in open sample libraries. There is **no high-quality, license-clear, per-note chromatic set that drops into `Tone.Sampler` with zero prep.** The workable paths all need modest preparation (slicing or format conversion). Candidates below, best-first.

## Candidate 1 — barisbozkurt CC0 chromatic kanun (Freesound) — *most license-airtight*

- **URL:** https://freesound.org/people/barisbozkurt/sounds/211133/ ("kanun_moderate_Chromatic_moreIsolated.mp3")
- **Format:** single MP3, mono, 44.1 kHz, 160 kbps, ~2:02 — **all chromatic tones across the instrument range, played as isolated notes in sequence** (one concatenated file).
- **License:** **CC0** (verified via page fetch) — copy/modify/distribute/perform, commercial OK, no attribution. Public-domain equivalent.
- **Trichord/realism:** real kanun, trichord shimmer present; mono + 160 kbps MP3 limits fidelity.
- **Integration:** download → onset-detect & slice into per-note files (Audacity silence-detect or `aubio`/pyin for pitch) → rename to Tone note names (`A2.ogg`, `C3.ogg`, …) → build Sampler URL map. ~2–4 h. Yields ~20–40 splice points.
- Freesound has ~22 "kanun" sounds total; the rest are loops/taqasim/one-shots, not multisamples.

## Candidate 2 — Nafe Parasite free qanun pack (KVR) — *most practical starting point*

- **Thread:** https://www.kvraudio.com/forum/viewtopic.php?t=510678 · **ZIP** (MediaFire, ~71.7 MB, confirmed live): `Qanun_Midi_notes_layout_and_instructions_for_EX24.zip`
- **Format:** 24-bit **AIFF** per-note files + a MIDI/EXS24 mapping (Logic). Exact note count/range **unconfirmed** in the thread.
- **License:** author calls it an "open-source project" — **informal blanket permission, no SPDX/CC deed.** Spirit clearly permissive; legally ambiguous for commercial use. **Email the author for a written CC0/CC-BY before public release.**
- **Trichord/realism:** real AIFF recordings (trichord inherent); no velocity layers (flat dynamics).
- **Integration:** unzip → `ffmpeg` AIFF→OGG batch → parse EXS24 XML for MIDI→file map → rename to Tone names → Sampler map. ~1–3 h with a script.

## Recommendation

- **Primary:** Candidate 2 (per-note AIFFs + EXS24 layout = least slicing) — *pending a one-email license confirmation.*
- **Fallback (ship-safe today):** Candidate 1 — **CC0**, no permission needed; costs a slice-and-label pass. Also good for filling gaps in any other set.
- Blend: use Candidate 2 for coverage, patch gaps with Candidate 1.

## Avoid (license-encumbered / unclear)

- **Dr. Ozan Yarman SF2** (`ozanyarman.com/files/QanunDrOz.sf2`): high-quality 79-tone real qanun, but **no license stated → default all-rights-reserved.** Get written permission first.
- **Musical Artifacts SF2 packs** (artifacts 940/941/947): kanun patches but "found online without copyright notice" — flagged by the community. Avoid for public deployment.
- **Commercial Kontakt/ENGINE libraries** (Sonokinetic ~€50, 8Dio ~$49–69, Best Service ~$150, EarthMoments, FasmaTwist): EULAs prohibit redistributing raw samples / use outside music productions — can't be served over HTTP.

## Confirmed absent (don't bother)

University of Iowa MIS, Philharmonia, VSCO 2 CE / VCSL (CC0), Sonatina, `nbrosowsky/tonejs-instruments`, `sfzinstruments` org, archive.org SF2 dump — all Western-only, no qanun. Safwan Matni "Kanun" is a synth VST (no WAVs), Windows-only.

## Open task for P2

Pick Candidate 1 (CC0) to de-risk, OR confirm Candidate 2's license by email. Then: prepare the per-note files, host under `public/samples/qanun/`, and wire a `Tone.Sampler` behind the existing `createQanunEngine.pluck()` interface (the engine is already sound-source agnostic). Optionally add a subtle detuned layer to reinforce the trichord shimmer.
