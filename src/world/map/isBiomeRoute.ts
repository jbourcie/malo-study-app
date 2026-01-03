export function isBiomeRoute(pathname: string): boolean {
  return pathname.startsWith('/biome/')
}

export function isBiomeRouteFromWindow(): boolean {
  if (typeof window === 'undefined') return false
  return isBiomeRoute(window.location.pathname || '')
}
