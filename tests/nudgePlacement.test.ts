import { describe, it, expect } from 'vitest'
import { nudgeRectPlacement } from '../src/world/overlay/layout/nudgePlacement'

describe('nudgeRectPlacement', () => {
  const bounds = { left: 0, top: 0, right: 200, bottom: 200 }

  it('returns unclamped when free', () => {
    const res = nudgeRectPlacement({ x: 10, y: 10 }, { w: 20, h: 20 }, [], bounds)
    expect(res.nudged).toBe(false)
    expect(res.x).toBe(10)
    expect(res.y).toBe(10)
  })

  it('nudges when collision', () => {
    const occupied = [{ x: 10, y: 10, w: 20, h: 20 }]
    const res = nudgeRectPlacement({ x: 10, y: 10 }, { w: 20, h: 20 }, occupied, bounds, { stepPx: 25, maxTries: 6 })
    expect(res.nudged).toBe(true)
    expect(res.tries).toBeGreaterThan(0)
    // ensure it doesn't collide
    const rect = { x: res.x, y: res.y, w: 20, h: 20 }
    const intersects = !(rect.x + rect.w <= occupied[0].x || occupied[0].x + occupied[0].w <= rect.x || rect.y + rect.h <= occupied[0].y || occupied[0].y + occupied[0].h <= rect.y)
    expect(intersects).toBe(false)
  })

  it('clamps within bounds', () => {
    const res = nudgeRectPlacement({ x: 500, y: -20 }, { w: 50, h: 50 }, [], bounds)
    expect(res.x).toBeLessThanOrEqual(bounds.right - 50)
    expect(res.y).toBeGreaterThanOrEqual(bounds.top)
  })
})
