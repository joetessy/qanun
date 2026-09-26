# Qanun

An interactive web **qanun** — the Arabic plucked box-zither — played with your **mouse** or your **hands over a webcam**. Authentic maqam tuning (quarter-tones, scale-locked strings), real sampled kanun sound, free modulation between ajnas via an Oriental-keyboard-style mandal panel, and a photoreal wood-and-brass interface.

Built on React 19 + TypeScript + Vite, Tone.js, and MediaPipe hand-tracking.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Click a string to pluck (drag to glide, hold to sustain), or press **play** to use your hands. The home row (`A`–`L`) plays the scale from the keyboard; `Z` / `X` shift the octave. Modulate by picking a **lower jins** (keys `Q`–`O`) and an **upper jins** (the digits `1`–`8` right above); press `M` for **qanun mode**, where the levers set each note. See [How modulation works](#how-modulation-works). The first-run guide (and the **?** button) explains the rest.

```bash
npm run test:run   # 366 tests
npm run build      # production build → dist/
```

## How modulation works

A **maqam** on this qanun is defined by two overlapping building blocks called *ajnas* (singular: *jins*):

- **Lower jins** — the foundational 4–5-note cell that sits on the tonic, giving the maqam its characteristic color. Rast, Bayati, Hijaz, Nahawand, Kurd, Nikriz, ʿAjam, Saba, and Sikah are the nine available families, mapped to the letter keys **Q W E R T Y U I O**.
- **Upper jins** — a second cell starting on the *ghammāz*, the pivot note at the top of the lower jins (the 5th over Rast, the 4th over Bayati, the 3rd over Saba). Any family except Sikah can sit on any lower jins; Sikah only starts a maqam. The upper row mirrors the lower row: the digit key above a family's letter picks the same family (`3` = upper Hijaz, `E` = lower Hijaz), and the slot above Sikah stays empty.

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

Pairings with a name of their own also include Nairuz, Mahur, Bayati Shuri, Hijazkar (Hijaz + Nikriz), Zanjaran, Hijazkar Kurd, ʿUshaq Masri, Nawa Athar, Shawq Afza, ʿIraq and Bastanikar. A dot under an upper-jins chip marks a pairing with a name. Any other pairing reads as the bare combination, e.g. **"Rast ▸ Kurd"**.

The HUD readout shows the maqam name and the home note, e.g. **"Bayati · home d"**.

### Qanun mode

Press `M` (or the mode switch) for a lever-by-lever qanun. The strings are the natural letters **C D E F G A B**, like a real qanun with every lever down. Each lever moves its note a quarter-tone at a time, up to two quarter-tones either way (♭ · ½♭ · ♮ · ½♯ · ♯). `Q`–`U` raise C–B, `1`–`7` lower them, and `0` (or the **naturals** button) resets every lever. A flipped lever lights up in the rail, and the C strings carry a faint tint so you can count octaves.

### The tune drawer

- **Tuning** — the **key** (one button per key, Jins mode only) and a ±100¢ **fine** tune.
- **Strings** — the **range**: drag either end of the slider (or click the track) to choose the lowest and highest string, from 8 strings up to 25. The lowest string is the 5th degree under the tonic: G3 in the key of C. The play keys follow the range. The **trem** slider sets the tremolo speed.
- **Studio** (record, drone, metronome) and **MIDI** out, both off by default.

Controls in the drawer give the keyboard back to the instrument after you click or drag them, so the arrow and letter keys never change a setting by accident.

## Credits

**Sound** — Sampled from a CC0/public-domain Turkish-kanun recording (Bozkurt, Freesound #211133); see [public/samples/qanun/NOTICE.md](public/samples/qanun/NOTICE.md). A Karplus-Strong synth voice is the fallback.

**Theory** — Maqam knowledge drawn from [maqamworld.com](https://www.maqamworld.com) and *Inside Arabic Music* by Johnny Farraj & Sami Abu Shumays (Oxford University Press, 2019).
