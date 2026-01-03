export type AnchorConfig = {
  x: number
  y: number
  radius?: number
}

export type BiomeMapConfig = {
  biomeId: string
  subject: string
  label: string
  anchor: AnchorConfig
  zones?: ZoneMapConfig[]
}

export type ZoneMapConfig = {
  zoneId: string
  themeId: string
  label: string
  anchor: AnchorConfig
}

export type WorldMapConfig = {
  id: string
  grade: string
  label: string
  baseLayer: {
    type: 'image' | 'svg'
    src: string
    aspectRatio: '16:9'
    width: number
    height: number
    padding?: number
  }
  biomes: BiomeMapConfig[]
}
