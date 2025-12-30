export type CosmeticType = 'monument_skin_biome' | 'monument_skin_zone' | 'tile_effect' | 'npc_style'

export type Cosmetic = {
  id: string
  type: CosmeticType
  label: string
  description: string
  costCoins?: number
  unlockLevel?: number
}

export const COSMETICS_CATALOG: Cosmetic[] = [
  // Biome monument skins (level unlock)
  { id: 'biome_skin_stone', type: 'monument_skin_biome', label: 'Pierre polie', description: 'Contours nets et liseré clair pour les grands monuments.', unlockLevel: 3 },
  { id: 'biome_skin_mossy', type: 'monument_skin_biome', label: 'Lierre ancien', description: 'Des veines vertes qui donnent du relief aux structures.', unlockLevel: 6 },
  { id: 'biome_skin_goldtrim', type: 'monument_skin_biome', label: 'Filets dorés', description: 'Bordures dorées discrètes pour les temples du biome.', unlockLevel: 10 },

  // Zone monument skins (level unlock)
  { id: 'zone_skin_slate', type: 'monument_skin_zone', label: 'Ardoise sombre', description: 'Effet ardoise avec reflets bleutés sur les zones.', unlockLevel: 2 },
  { id: 'zone_skin_brass', type: 'monument_skin_zone', label: 'Brassage cuivre', description: 'Teinte cuivre et rivets façon atelier.', unlockLevel: 5 },
  { id: 'zone_skin_crystal', type: 'monument_skin_zone', label: 'Cristaux prismatiques', description: 'Reflets pastel et facettes légères.', unlockLevel: 8 },

  // Tile effects (coin purchases)
  { id: 'tile_effect_glow', type: 'tile_effect', label: 'Halo azur', description: 'Léger halo lumineux autour des tuiles actives.', costCoins: 40 },
  { id: 'tile_effect_spark', type: 'tile_effect', label: 'Étincelles', description: 'Petites étincelles animées sur les blocs stabilisés.', costCoins: 80 },

  // NPC styles
  { id: 'npc_style_forge', type: 'npc_style', label: 'Forge', description: 'Bulles anguleuses, badges métal.', costCoins: 60 },
  { id: 'npc_style_scribe', type: 'npc_style', label: 'Scribe', description: 'Contours encre et cartouche parchemin.', unlockLevel: 7 },
]

const COSMETICS_BY_ID = new Map(COSMETICS_CATALOG.map(c => [c.id, c]))

export function getCosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS_BY_ID.get(id)
}
