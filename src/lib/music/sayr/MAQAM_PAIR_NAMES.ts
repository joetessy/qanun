// Lower + upper jins pairings with a maqam name of their own (maqamworld's
// family tables), keyed "lower|upper" with the upper on the lower's ghammāz.
// Names are the scale's, whatever the key: the instrument spells Huzam on
// E½♭ and ʿIraq on E½♭ alike, though ʿIraq traditionally sits on B½♭.
// (identifyAjnas keeps its own table, MAQAM_NAMES, for reading a raw tuning.)
export const MAQAM_PAIR_NAMES: Readonly<Record<string, string>> = {
  'rast|hijaz': 'Maqam Suznak',
  'rast|bayati': 'Maqam Nairuz',
  'rast|ajam': 'Maqam Mahur',
  'bayati|hijaz': 'Maqam Bayati Shuri',
  // Nikriz's raised 4th wraps under the home (applyUpperJins): D E♭ F♯ G A B♭ C♯.
  'hijaz|nikriz': 'Maqam Hijazkar',
  'hijaz|ajam': 'Maqam Zanjaran',
  'kurd|nikriz': 'Maqam Hijazkar Kurd',
  'nahawand|bayati': 'Maqam ʿUshaq Masri',
  'nikriz|hijaz': 'Maqam Nawa Athar',
  'ajam|hijaz': 'Maqam Shawq Afza',
  'sikah|hijaz': 'Maqam Huzam',
  'sikah|bayati': 'Maqam ʿIraq',
  'sikah|saba': 'Maqam Bastanikar'
}
