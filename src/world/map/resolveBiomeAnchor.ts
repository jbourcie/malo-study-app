import type { GraphicPackManifest } from '../graphicPacks/types'
import type { WorldMapConfig, AnchorConfig } from '../mapConfig/types'
import type { BiomeDef } from '../../game/biomeCatalog'

export function resolveBiomeAnchor(
  biome: Pick<BiomeDef, 'id' | 'subject'>,
  packManifest?: GraphicPackManifest | null,
  mapConfig?: WorldMapConfig | null
): AnchorConfig | null {
  const packAnchors = packManifest?.anchors?.world?.biomes || {}
  const fromPack = packAnchors[biome.id] || packAnchors[biome.subject]
  if (fromPack && isValidAnchor(fromPack)) return fromPack

  const fallback = mapConfig?.biomes.find(b => b.biomeId === biome.id)?.anchor
  return fallback && isValidAnchor(fallback) ? fallback : null
}

function isValidAnchor(anchor: any): anchor is AnchorConfig {
  return anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number'
}
