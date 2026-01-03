import { describe, expect, it } from 'vitest'
import { isSvgLayer } from '../src/world/map/isSvgLayer'

describe('isSvgLayer', () => {
  it('detects svg extension regardless of casing', () => {
    expect(isSvgLayer('map.svg')).toBe(true)
    expect(isSvgLayer('MAP.SVG')).toBe(true)
  })

  it('ignores query strings and hash fragments', () => {
    expect(isSvgLayer('map.svg?v=123')).toBe(true)
    expect(isSvgLayer('map.svg#layer')).toBe(true)
    expect(isSvgLayer('map.svg?version=1#hash')).toBe(true)
  })

  it('returns false for raster formats or missing path', () => {
    expect(isSvgLayer('map.png')).toBe(false)
    expect(isSvgLayer('map.webp?cache=1')).toBe(false)
    expect(isSvgLayer('')).toBe(false)
    expect(isSvgLayer(undefined)).toBe(false)
  })
})
