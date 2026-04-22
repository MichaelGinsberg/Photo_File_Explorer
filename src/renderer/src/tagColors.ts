export const GROUP_COLORS = [
  '#B48EAD', // nord15 — purple  (default for ungrouped tags)
  '#88C0D0', // nord8  — cyan
  '#A3BE8C', // nord14 — green
  '#8FBCBB', // nord7  — teal
  '#D08770', // nord12 — orange
  '#EBCB8B', // nord13 — yellow
  '#81A1C1', // nord9  — blue-grey
]

export const DEFAULT_TAG_COLOR = GROUP_COLORS[0]

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
