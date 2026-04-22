// Extensions (uppercase, no dot) that Chromium cannot decode as images.
// Files with these extensions are listed and tagged normally but skip
// the <img> load and show a camera-icon placeholder instead.
export const RAW_EXTS = new Set([
  // Fujifilm
  'RAF',
  // Canon
  'CR2', 'CR3',
  // Nikon
  'NEF', 'NRW',
  // Sony
  'ARW', 'SRF', 'SR2',
  // Olympus / OM System
  'ORF',
  // Panasonic
  'RW2',
  // Leica
  'RWL',
  // Adobe / Pentax / Ricoh DNG
  'DNG', 'PEF',
  // Sigma
  'X3F',
  // Hasselblad
  '3FR',
  // Leica / generic
  'RAW',
  // Minolta / Konica-Minolta
  'MRW',
  // Kodak
  'KDC', 'DCR',
  // Mamiya / Phase One
  'MEF', 'IIQ',
  // Epson
  'ERF',
])
