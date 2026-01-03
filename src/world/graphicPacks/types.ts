export type GraphicPackManifest = {
  id: string
  label: string
  grade: string
  version: string
  map: {
    baseLayer: string
    width: number
    height: number
  }
  maps?: {
    world?: {
      baseLayer: string
      width: number
      height: number
    }
    biomes?: Record<string, {
      baseLayer: string
      width: number
      height: number
    }>
    zones?: Record<string, {
      baseLayer: string
      width: number
      height: number
    }>
  }
  css: string[]
  anchors?: {
    world?: {
      safeArea?: {
        left?: number
        top?: number
        right?: number
        bottom?: number
      }
      biomes?: Record<string, {
        x: number
        y: number
        radius?: number
      }>
    }
    biomes?: Record<string, {
      safeArea?: {
        left?: number
        top?: number
        right?: number
        bottom?: number
      }
      zones?: Record<string, {
        x: number
        y: number
        radius?: number
      }>
    }>
    zones?: Record<string, {
      safeArea?: {
        left?: number
        top?: number
        right?: number
        bottom?: number
      }
      blocks?: Record<string, {
        x: number
        y: number
        radius?: number
      }>
    }>
  }
  assets?: {
    biomes?: string
    zones?: string
    monuments?: string
    [key: string]: string | undefined
  }
}

export type LoadedGraphicPack = {
  manifest: GraphicPackManifest
  baseLayerUrl: string
  cssUrls: string[]
  packRootUrl: string
}
