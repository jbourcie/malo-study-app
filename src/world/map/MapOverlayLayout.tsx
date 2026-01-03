import React from 'react'
import type { AnchorConfig } from '../mapConfig/types'
import type { GraphicPackManifest } from '../graphicPacks/types'

type MapOverlayLayoutProps = {
  width: number
  height: number
  safeArea?: GraphicPackManifest['anchors'] extends { safeArea?: infer T } ? T : undefined
  children: (toCssPos: (anchor: AnchorConfig) => React.CSSProperties) => React.ReactNode
}

export function anchorToCss(anchor: AnchorConfig, width: number, height: number, safeArea?: MapOverlayLayoutProps['safeArea']): React.CSSProperties {
  const clamped = clampAnchorToSafeArea(anchor, width, height, safeArea)
  const leftPct = (clamped.x / width) * 100
  const topPct = (clamped.y / height) * 100
  return {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: 'translate(-50%, -50%)',
  }
}

export function clampAnchorToSafeArea(anchor: AnchorConfig, width: number, height: number, safeArea?: MapOverlayLayoutProps['safeArea']): AnchorConfig {
  if (!safeArea) return anchor
  const { left = 0, right = 0, top = 0, bottom = 0 } = safeArea
  return {
    ...anchor,
    x: Math.min(Math.max(anchor.x, left), Math.max(0, width - right)),
    y: Math.min(Math.max(anchor.y, top), Math.max(0, height - bottom)),
  }
}

export function MapOverlayLayout({ width, height, children, safeArea }: MapOverlayLayoutProps) {
  const toCssPos = React.useCallback((anchor: AnchorConfig) => anchorToCss(anchor, width, height, safeArea), [width, height, safeArea])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {children(toCssPos)}
    </div>
  )
}
