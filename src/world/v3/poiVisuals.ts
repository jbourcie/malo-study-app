export function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value || 0)))
}

export function shouldShowHalo(state: string, highlight: boolean | undefined, prefersReducedMotion: boolean, haloStates: string[]): boolean {
  if (prefersReducedMotion) return false
  return !!highlight || haloStates.includes(state)
}
