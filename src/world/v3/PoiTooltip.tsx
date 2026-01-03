import React from 'react'
import { createPortal } from 'react-dom'
import type { BlockVisualState } from './progressionStates'

export function clampTooltipPosition(rect: DOMRect, viewport: { w: number; h: number }, offset = 12): { left: number; top: number } {
  const preferredTop = rect.top - offset
  const preferredLeft = rect.left + rect.width / 2
  const top = Math.max(offset, Math.min(preferredTop, viewport.h - offset))
  const left = Math.max(offset, Math.min(preferredLeft, viewport.w - offset))
  return { left, top }
}

type PoiTooltipProps = {
  label: string
  masteryPct: number
  state?: BlockVisualState | 'progressing' | 'rebuilding' | 'rebuilt' | 'discovering'
  anchorRef?: React.RefObject<HTMLElement | null>
  visible: boolean
  onHoverStart?: () => void
  onHoverEnd?: () => void
}

export function PoiTooltip({ label, masteryPct, state, anchorRef, visible, onHoverStart, onHoverEnd }: PoiTooltipProps) {
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 })

  React.useEffect(() => {
    if (!visible) return
    const el = anchorRef?.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const viewport = { w: window.innerWidth, h: window.innerHeight }
    setPos(clampTooltipPosition(rect, viewport))
  }, [anchorRef, visible, label, masteryPct])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="mc-poiTooltip"
      style={{ left: pos.left, top: pos.top }}
      onMouseEnter={() => onHoverStart?.()}
      onMouseLeave={() => onHoverEnd?.()}
    >
      <div className="mc-poiTooltip__label" title={label}>{label}</div>
      <div className="mc-poiTooltip__meta">
        <span className={`mc-poiTooltip__pill is-${state || 'default'}`}>{Math.round(masteryPct)}%</span>
        <span className="mc-poiTooltip__bar"><span style={{ width: `${Math.min(100, Math.max(0, masteryPct))}%` }} /></span>
      </div>
    </div>,
    document.body,
  )
}
