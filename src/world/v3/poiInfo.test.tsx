import { describe, expect, it } from 'vitest'
import { clampTooltipPosition } from './PoiTooltip'

describe('clampTooltipPosition', () => {
  it('keeps tooltip within viewport bounds', () => {
    const rect = new DOMRect(10, 10, 40, 20)
    const pos = clampTooltipPosition(rect, { w: 100, h: 60 }, 12)
    expect(pos.left).toBeGreaterThanOrEqual(12)
    expect(pos.top).toBeGreaterThanOrEqual(12)
    const rect2 = new DOMRect(500, 500, 100, 60)
    const pos2 = clampTooltipPosition(rect2, { w: 520, h: 520 }, 10)
    expect(pos2.left).toBeLessThanOrEqual(510)
    expect(pos2.top).toBeLessThanOrEqual(510)
  })
})
