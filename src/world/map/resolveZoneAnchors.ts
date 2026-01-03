import { TAG_CATALOG, type SubjectId } from '../../taxonomy/tagCatalog'
import type { GraphicPackManifest } from '../graphicPacks/types'
import { zoneKey } from '../../game/rebuildService'
import type { AnchorConfig } from '../mapConfig/types'

export type ZoneOverlayDef = {
  subjectId: SubjectId
  themeLabel: string
  anchor: AnchorConfig
  zoneKey: string
  tagIds: string[]
}

export function resolveZoneAnchors(subjectId: SubjectId, manifest?: GraphicPackManifest | null): ZoneOverlayDef[] {
  const anchorsRoot = manifest?.anchors?.biomes
  if (!anchorsRoot) return []
  const byTheme: Record<string, { label: string, tagIds: string[] }> = {}
  Object.values(TAG_CATALOG).forEach((meta) => {
    if (meta.subject !== subjectId) return
    const key = meta.theme.toLowerCase()
    if (!byTheme[key]) byTheme[key] = { label: meta.theme, tagIds: [] }
    byTheme[key].tagIds.push(meta.id)
  })

  const anchorsForSubject = anchorsRoot[subjectId]?.zones
  if (!anchorsForSubject) return []

  const zones: ZoneOverlayDef[] = []
  Object.entries(anchorsForSubject).forEach(([themeLabel, anchor]) => {
    const themeKey = themeLabel.toLowerCase()
    const matched = byTheme[themeKey]
    if (!matched || matched.tagIds.length === 0) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`Anchor ignoré (zone inconnue)`, { subjectId, themeLabel })
      }
      return
    }
    zones.push({
      subjectId,
      themeLabel: matched.label,
      anchor,
      zoneKey: zoneKey(subjectId, matched.label),
      tagIds: matched.tagIds,
    })
  })
  return zones
}
