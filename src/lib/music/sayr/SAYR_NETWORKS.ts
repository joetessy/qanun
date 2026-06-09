// Per-maqam ordered idiomatic modulation networks.
// Data sourced from docs/research/maqam-sayr-catalog.md (Farraj & Abu Shumays, OUP 2019, Ch. 24).
// All apply.id values MUST resolve to a real MAQAM_PRESETS id or JINS_PAIRS id.
// apply.kind === 'preset' → call setMaqamPreset(id)
// apply.kind === 'pair'   → call applyPair(JINS_PAIRS.find(p => p.id === id))

export type SayrRelationship = 'jins-pair' | 'upper-jins' | 'shared-ghammaz' | 'tonic-recolor'

export interface SayrMove {
  label: string
  relationship: SayrRelationship
  apply: { kind: 'preset'; id: string } | { kind: 'pair'; id: string }
}

// 8 core maqam ids mapped to their ordered idiomatic next-moves.
// Ordered most-idiomatic first per the catalog's "Typical modulations (ordered)" entries.
export const SAYR_NETWORKS: Record<string, readonly SayrMove[]> = {
  // ── Maqam Rast ────────────────────────────────────────────────────────────
  // Catalog: Suznak (Hijaz on 5) is practically obligatory; then Bayati on 5 /
  // Nahawand on 5; then Nikriz as a tonic-recolor; Saba jins-pair on ghammaz.
  rast: [
    { label: 'Suznak (Hijaz on 5)',  relationship: 'upper-jins',    apply: { kind: 'preset', id: 'suznak'   } },
    { label: 'Nahawand on 5',        relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Bayati on 5 (Nairuz)', relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'bayati'   } },
    { label: 'Nikriz (same tonic)',   relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'nikriz'   } },
    { label: 'Bayati ↔ Saba',        relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'bayati-saba'    } },
  ],

  // ── Maqam Suznak ──────────────────────────────────────────────────────────
  // Catalog: Suznak IS Rast+Hijaz on 5. Moves: to Rast (remove Hijaz upper),
  // Bayati on 5, Nahawand on 5; Hijaz↔Hijazkar pair active.
  suznak: [
    { label: 'Rast (remove Hijaz on 5)',  relationship: 'upper-jins',    apply: { kind: 'preset', id: 'rast'     } },
    { label: 'Bayati on 5 (Nairuz)',      relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'bayati'   } },
    { label: 'Nahawand on 5',            relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Hijaz (remove Rast root)',  relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'hijaz'    } },
    { label: 'Hijaz ↔ Hijazkar',         relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'hijaz-hijazkar' } },
  ],

  // ── Maqam Nahawand ────────────────────────────────────────────────────────
  // Catalog: to Kurd on 5; to Hijaz on 5; to Bayati on 5; to Nikriz on root;
  // Bayati↔Saba pair available on the 5th cluster.
  nahawand: [
    { label: 'Kurd on 5',                relationship: 'upper-jins',    apply: { kind: 'preset', id: 'kurd'     } },
    { label: 'Bayati on 5 (ʿUshshaq)',   relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'bayati'   } },
    { label: 'Hijaz on 5 (harmonic min)',relationship: 'upper-jins',    apply: { kind: 'preset', id: 'hijaz'    } },
    { label: 'Nikriz (raised 4th)',       relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'nikriz'   } },
    { label: 'Bayati ↔ Saba',            relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'bayati-saba'    } },
  ],

  // ── Maqam Bayati ──────────────────────────────────────────────────────────
  // Catalog: to Hijaz on 4 (near-obligatory, Bayati Shuri pathway); to
  // Nahawand on 4; to Kurd on 4; Saba jins-pair (lower the 4th).
  bayati: [
    { label: 'Hijaz on 4 (Bayati Shuri)',relationship: 'upper-jins',    apply: { kind: 'preset', id: 'hijaz'    } },
    { label: 'Nahawand on 4',            relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Kurd on 4',               relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'kurd'     } },
    { label: 'Bayati ↔ Saba',           relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'bayati-saba'    } },
    { label: 'Nikriz (raised 4th)',      relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'nikriz'   } },
  ],

  // ── Maqam Hijaz ───────────────────────────────────────────────────────────
  // Catalog: to Rast on 4; to Nahawand on 4; Hijaz↔Hijazkar (raise leading tone);
  // Saba on 4 (Bayati↔Saba pair); Bayati on root.
  hijaz: [
    { label: 'Nahawand on 4',            relationship: 'upper-jins',    apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Kurd on 4 (darken root)',  relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'kurd'     } },
    { label: 'Rast (Rast-family color)', relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'rast'     } },
    { label: 'Hijaz ↔ Hijazkar',        relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'hijaz-hijazkar' } },
    { label: 'Bayati ↔ Saba',           relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'bayati-saba'    } },
  ],

  // ── Maqam Kurd ────────────────────────────────────────────────────────────
  // Catalog: to Nahawand on 4 (ascending-Kurd's main upper jins);
  // to Hijaz on 4 (harmonic color); to Saba (lower-4th recolor); to Bayati.
  kurd: [
    { label: 'Nahawand on 4 (Kurd sayr)', relationship: 'upper-jins',    apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Hijaz on 4 (harmonic)',      relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'hijaz'    } },
    { label: 'Bayati (raise 2nd)',         relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'bayati'   } },
    { label: 'Bayati ↔ Saba',             relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'bayati-saba'    } },
  ],

  // ── Maqam Nikriz ──────────────────────────────────────────────────────────
  // Catalog: to Nahawand on 5 (main upper jins); to Rast (lower the raised 4th);
  // to Bayati on 5; Hijazkar pair available.
  nikriz: [
    { label: 'Nahawand on 5',            relationship: 'upper-jins',    apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Rast (remove raised 4th)', relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'rast'     } },
    { label: 'Bayati (lower 2nd)',       relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'bayati'   } },
    { label: 'Hijaz ↔ Hijazkar',        relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'hijaz-hijazkar' } },
  ],

  // ── Maqam Saba ────────────────────────────────────────────────────────────
  // Catalog: highly constrained. To Hijaz on 3 (definitional);
  // to Nahawand on 4; Bayati↔Saba pair (raise 4th back).
  saba: [
    { label: 'Hijaz on 3 (Saba sayr)',   relationship: 'upper-jins',    apply: { kind: 'preset', id: 'hijaz'    } },
    { label: 'Nahawand on 4',            relationship: 'shared-ghammaz', apply: { kind: 'preset', id: 'nahawand' } },
    { label: 'Bayati (raise 4th)',       relationship: 'tonic-recolor',  apply: { kind: 'preset', id: 'bayati'   } },
    { label: 'Bayati ↔ Saba',           relationship: 'jins-pair',      apply: { kind: 'pair',   id: 'bayati-saba'    } },
  ],
}
