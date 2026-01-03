import { joinUrl, trimTrailingSlash } from './url'
import type { GraphicPackManifest, LoadedGraphicPack } from './types'

function ensureManifestIsValid(manifest: GraphicPackManifest) {
  if (!manifest || !manifest.id || !manifest.label || !manifest.grade || !manifest.version) {
    throw new Error('Manifest du pack graphique incomplet (identité manquante)')
  }
  if (!manifest.map || !manifest.map.baseLayer) {
    throw new Error('Manifest du pack graphique invalide (map manquante)')
  }
  if (!isPositiveNumber(manifest.map.width) || !isPositiveNumber(manifest.map.height)) {
    throw new Error('Manifest du pack graphique invalide (dimensions requises)')
  }
  if (!Array.isArray(manifest.css) || manifest.css.length === 0) {
    throw new Error('Manifest du pack graphique invalide (CSS requis)')
  }
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function derivePackRootUrl(manifestUrl: string): string {
  const withoutHash = manifestUrl.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const suffix = '/pack.json'
  if (withoutQuery.endsWith(suffix)) {
    return trimTrailingSlash(withoutQuery.slice(0, withoutQuery.length - suffix.length))
  }
  return trimTrailingSlash(withoutQuery)
}

async function fetchManifest(manifestUrl: string): Promise<{ manifest: GraphicPackManifest, finalUrl: string }> {
  const env = (import.meta as any)?.env || {}
  const baseUrl = typeof env?.BASE_URL === 'string' ? env.BASE_URL : '/'
  const candidates = [manifestUrl]
  if (manifestUrl.startsWith('/') && baseUrl && baseUrl !== '/') {
    const withBase = joinUrl(baseUrl, manifestUrl)
    if (!candidates.includes(withBase)) candidates.push(withBase)
  }

  let lastStatus: number | null = null
  for (const candidate of candidates) {
    const response = await fetch(candidate)
    if (response.ok) {
      let manifest: GraphicPackManifest
      try {
        manifest = await response.json()
      } catch {
        throw new Error('Pack graphique illisible (JSON invalide)')
      }
      return { manifest, finalUrl: candidate }
    }
    lastStatus = response.status
  }
  throw new Error(`Impossible de charger le pack graphique (${lastStatus ?? 'network'})`)
}

export async function loadGraphicPack(manifestUrl: string): Promise<LoadedGraphicPack> {
  const { manifest, finalUrl } = await fetchManifest(manifestUrl)

  ensureManifestIsValid(manifest)

  const packRootUrl = derivePackRootUrl(finalUrl)
  const mapSource = manifest.maps?.world || manifest.map
  const baseLayerUrl = joinUrl(packRootUrl, mapSource.baseLayer)
  const cssUrls = manifest.css.map(path => joinUrl(packRootUrl, path))

  return {
    manifest,
    baseLayerUrl,
    cssUrls,
    packRootUrl,
  }
}
