export function getDefaultGraphicPackManifestUrl(): string {
  const env = (import.meta as any)?.env || {}
  const override = env?.VITE_GRAPHIC_PACK
  if (typeof override === 'string' && override.trim().length > 0) {
    return override.trim()
  }
  const docBase = typeof document !== 'undefined'
    ? (() => {
        try {
          return new URL(document.baseURI).pathname || '/'
        } catch {
          return '/'
        }
      })()
    : '/'
  const baseCandidate = typeof env?.VITE_BASE_PATH === 'string' && env.VITE_BASE_PATH.trim()
    ? env.VITE_BASE_PATH
    : typeof env?.BASE_URL === 'string' && env.BASE_URL.trim()
      ? env.BASE_URL
      : docBase
  return joinUrl(baseCandidate, 'assets/graphic-packs/pack-5e-mvp/pack.json')
}

export function getGraphicPackForGrade(_grade?: string | null): string {
  return getDefaultGraphicPackManifestUrl()
}
import { joinUrl } from './url'
