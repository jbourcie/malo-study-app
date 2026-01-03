export type Rect = { x: number; y: number; w: number; h: number }
export type NudgeResult = { x: number; y: number; nudged: boolean; tries: number }

function intersects(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

export function nudgeRectPlacement(
  desired: { x: number; y: number },
  rectSize: { w: number; h: number },
  occupied: Rect[],
  bounds: { left: number; top: number; right: number; bottom: number },
  opts?: { maxTries?: number; stepPx?: number; growthEvery?: number }
): NudgeResult {
  const maxTries = opts?.maxTries ?? 12
  const step = opts?.stepPx ?? 8
  const growthEvery = opts?.growthEvery ?? 4

  const clamped = {
    x: clamp(desired.x, bounds.left, bounds.right - rectSize.w),
    y: clamp(desired.y, bounds.top, bounds.bottom - rectSize.h),
  }
  let candidate: Rect = { x: clamped.x, y: clamped.y, w: rectSize.w, h: rectSize.h }
  if (!occupied.some(o => intersects(o, candidate))) {
    return { x: candidate.x, y: candidate.y, nudged: false, tries: 0 }
  }

  const offsets = [
    [1, 0], [0, 1], [-1, 0], [0, -1],
    [1, 1], [-1, 1], [-1, -1], [1, -1],
  ]

  let tries = 0
  for (let i = 0; i < maxTries; i++) {
    const amp = step * (1 + Math.floor(i / growthEvery))
    const off = offsets[i % offsets.length]
    const nx = clamp(clamped.x + off[0] * amp, bounds.left, bounds.right - rectSize.w)
    const ny = clamp(clamped.y + off[1] * amp, bounds.top, bounds.bottom - rectSize.h)
    candidate = { x: nx, y: ny, w: rectSize.w, h: rectSize.h }
    tries = i + 1
    if (!occupied.some(o => intersects(o, candidate))) {
      return { x: candidate.x, y: candidate.y, nudged: true, tries }
    }
  }
  return { x: candidate.x, y: candidate.y, nudged: true, tries: maxTries }
}
