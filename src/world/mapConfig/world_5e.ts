import type { WorldMapConfig } from './types'

export const WORLD_5E_MAP: WorldMapConfig = {
  id: 'world-5e',
  grade: '5e',
  label: 'MaloCraft 5e',
  baseLayer: {
    type: 'svg',
    src: 'base/map.svg',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
  },
  biomes: [
    {
      biomeId: 'biome_fr_foret_langue',
      subject: 'fr',
      label: 'Français',
      anchor: { x: 320, y: 520, radius: 140 },
    },
    {
      biomeId: 'biome_math_mines',
      subject: 'math',
      label: 'Mathématiques',
      anchor: { x: 720, y: 420, radius: 140 },
    },
    {
      biomeId: 'biome_en_village',
      subject: 'en',
      label: 'Anglais',
      anchor: { x: 1120, y: 360, radius: 140 },
    },
    {
      biomeId: 'biome_es_village',
      subject: 'es',
      label: 'Espagnol',
      anchor: { x: 1420, y: 620, radius: 140 },
    },
    {
      biomeId: 'biome_hist_plaines',
      subject: 'hist',
      label: 'Histoire',
      anchor: { x: 980, y: 720, radius: 140 },
    },
  ],
}
