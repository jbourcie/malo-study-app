export function isSvgLayer(path: string | null | undefined): boolean {
  if (!path) return false
  const clean = path.split(/[?#]/)[0]?.trim().toLowerCase()
  return clean.endsWith('.svg')
}
