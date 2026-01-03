import type { GraphicPackManifest } from '../graphicPacks/types'
import { joinUrl } from '../graphicPacks/url'
import { slugifyZoneLabel, zoneKey as slugZoneKey } from '../slug'

export type MapResolved = {
  baseLayerUrl: string
  width: number
  height: number
  safeArea?: { left?: number; right?: number; top?: number; bottom?: number }
}

export function resolveWorldMap(manifest: GraphicPackManifest, packRootUrl: string): MapResolved {
  const mapSource = manifest.maps?.world || manifest.map
  return {
    baseLayerUrl: joinUrl(packRootUrl, mapSource.baseLayer),
    width: mapSource.width,
    height: mapSource.height,
    safeArea: manifest.anchors?.world?.safeArea,
  }
}

export function resolveBiomeMap(manifest: GraphicPackManifest, packRootUrl: string, biomeId: string, subjectId?: string): MapResolved | null {
  const biomeMap = manifest.maps?.biomes?.[biomeId] || (subjectId ? manifest.maps?.biomes?.[subjectId] : undefined)
  if (!biomeMap) return null
  const anchors = manifest.anchors?.biomes?.[biomeId] || (subjectId ? manifest.anchors?.biomes?.[subjectId] : undefined)
  if (typeof console !== 'undefined') {
    // debug log removed
  }
  return {
    baseLayerUrl: joinUrl(packRootUrl, biomeMap.baseLayer),
    width: biomeMap.width,
    height: biomeMap.height,
    safeArea: anchors?.safeArea,
  }
}

function zoneIdCandidates(biomeId: string, subjectId: string, zoneKey: string, themeLabel?: string): string[] {
  const label = themeLabel || zoneKey
  const slugifiedLabel = slugifyZoneLabel(label)
  return [
    `${biomeId}:${zoneKey}`,
    `${biomeId}:${label}`,
    `${biomeId}:${slugifiedLabel}`,
    `${subjectId}:${zoneKey}`,
    `${subjectId}:${label}`,
    `${subjectId}:${slugifiedLabel}`,
    slugZoneKey(subjectId, label),
  ]
}

export function resolveZoneMap(manifest: GraphicPackManifest, packRootUrl: string, biomeId: string, zoneKey: string, subjectId?: string, themeLabel?: string): MapResolved | null {
  const candidates = zoneIdCandidates(biomeId, subjectId || biomeId, zoneKey, themeLabel)
  for (const key of candidates) {
    const zoneMap = manifest.maps?.zones?.[key]
    if (!zoneMap) continue
    const anchors = manifest.anchors?.zones?.[key]
    if (typeof console !== 'undefined') {
      // debug log removed
    }
    return {
      baseLayerUrl: joinUrl(packRootUrl, zoneMap.baseLayer),
      width: zoneMap.width,
      height: zoneMap.height,
      safeArea: anchors?.safeArea,
    }
  }
  return null
}

export function hasZoneMap(manifest: GraphicPackManifest, biomeId: string, zoneKey: string, subjectId?: string, themeLabel?: string): boolean {
  const candidates = zoneIdCandidates(biomeId, subjectId || biomeId, zoneKey, themeLabel)
  return candidates.some(key => !!manifest.maps?.zones?.[key])
}
