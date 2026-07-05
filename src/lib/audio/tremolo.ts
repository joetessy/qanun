// Tremolo pulse constants, in their own module so UI code (Controls, the hook's
// initial state) can import them without pulling Tone.js into the eager bundle —
// the audio engine is dynamically imported on first user interaction.

/** Default rashsh tremolo rate in Hz (~10 picks/s — a brisk Arabic tremolo).
 *  Runtime-tunable via setTremoloHz (the tune drawer's tremolo slider); both
 *  hold shapes — single-note rashsh and the two-note trill — ride this one
 *  shared pulse, so retuning it never changes their relationship. */
export const DEFAULT_TREMOLO_HZ = 10

/** setTremoloHz clamp. Below ~6 Hz the re-strikes read as separate plucks, not
 *  a tremolo; above ~16 Hz strikes start to fuse on the ~1.5 s ring (the trill
 *  pair blurs toward a continuous dyad — see TRILL_PULSE_MULT). */
export const TREMOLO_HZ_MIN = 6
export const TREMOLO_HZ_MAX = 16
