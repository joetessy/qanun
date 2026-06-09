// Display a fine-tune offset for the TUNE menu: bare "0" at centre, otherwise a
// signed value with the cent glyph (e.g. "+30¢", "−45¢"). Uses a true minus sign
// (U+2212) to match the ± typography elsewhere in the controls.
export const formatCents = (cents: number): string => {
  if (cents === 0) return '0'
  return cents > 0 ? `+${cents}¢` : `−${Math.abs(cents)}¢`
}
