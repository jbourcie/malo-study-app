import React from 'react'
import type { AnchorConfig } from '../mapConfig/types'
import { anchorToCss, clampAnchorToSafeArea } from './MapOverlayLayout'

type DebugAnchor = {
  id: string
  anchor: AnchorConfig
}

type MapAnchorsDebugLayerProps = {
  width: number
  height: number
  anchors: DebugAnchor[]
  safeArea?: { left?: number; right?: number; top?: number; bottom?: number }
  containerRef?: React.RefObject<HTMLDivElement | null>
  onAnchorChange?: (id: string, anchor: AnchorConfig) => void
}

export function MapAnchorsDebugLayer({ width, height, anchors, safeArea, containerRef, onAnchorChange }: MapAnchorsDebugLayerProps) {
  if (!anchors.length) return null

  // Small debug helper to trace pointer handling when drag seems blocked.
  if (typeof console !== 'undefined' && console.info) {
    console.info('[MapAnchorsDebugLayer] render', { anchorCount: anchors.length, hasOnChange: !!onAnchorChange, safeArea })
  }

  const handlePointerDown = (id: string, anchor: AnchorConfig, e: React.PointerEvent) => {
    if (!containerRef?.current) return
    e.preventDefault()
    console.info('[MapAnchorsDebugLayer] pointerdown', { id, x: anchor.x, y: anchor.y, target: e.target })
    const startRadius = anchor.radius
    const lastMoveLog = { t: 0 }
    const handleMove = (ev: PointerEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const relX = ev.clientX - rect.left
      const relY = ev.clientY - rect.top
      const x = (relX / rect.width) * width
      const y = (relY / rect.height) * height
      const clamped = clampAnchorToSafeArea({ x, y, radius: startRadius }, width, height, safeArea)
      onAnchorChange?.(id, clamped)
      const now = performance.now()
      if (now - lastMoveLog.t > 200) {
        console.debug('[MapAnchorsDebugLayer] pointermove', { id, x: clamped.x, y: clamped.y, radius: clamped.radius })
        lastMoveLog.t = now
      }
    }
    const handleUp = () => {
      console.info('[MapAnchorsDebugLayer] pointerup', { id })
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const handleCapture = (e: React.PointerEvent) => {
    if (typeof console !== 'undefined' && console.info) {
      const target = e.target as HTMLElement
      console.info('[MapAnchorsDebugLayer] capture pointerdown', {
        targetTag: target?.tagName,
        targetClass: target?.className,
        targetDataset: target?.dataset,
        layer: 'debug',
        x: e.clientX,
        y: e.clientY,
      })
    }
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
      onPointerDown={handleCapture}
    >
      {anchors.map(({ id, anchor }) => {
        const pos = anchorToCss(anchor, width, height, safeArea)
        const radius = typeof anchor.radius === 'number' ? anchor.radius : null
        return (
          <div
            key={id}
            style={{ ...pos, transform: `${pos.transform} scale(1)`, pointerEvents: onAnchorChange ? 'auto' : 'none' }}
            onPointerDown={onAnchorChange ? (e) => handlePointerDown(id, anchor, e) : undefined}
          >
            <div style={{ position: 'relative' }}>
              <div
                data-anchor-id={id}
                style={{
                  width: 28,
                  height: 28,
                  marginTop: -7,
                  marginLeft: -7,
                  background: '#ff9fb0',
                  borderRadius: 999,
                  boxShadow: '0 0 10px rgba(255,159,176,0.95)',
                  border: '2px solid #0f172a',
                  cursor: onAnchorChange ? 'grab' : 'default',
                  pointerEvents: onAnchorChange ? 'auto' : 'none',
                  touchAction: 'none',
                }}
                onPointerDown={onAnchorChange ? (e) => handlePointerDown(id, anchor, e) : undefined}
              />
              <div style={{ position: 'absolute', top: -6, left: '50%', width: 1, height: 20, background: '#ff9fb0' }} />
              <div style={{ position: 'absolute', top: '50%', left: -9, height: 1, width: 20, background: '#ff9fb0' }} />
              {radius && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: '50%',
                  border: '1px dashed rgba(255,159,176,0.8)',
                  transform: 'translate(-50%, -50%)',
                }} />
              )}
              <div style={{ position: 'absolute', top: 14, left: 14, fontSize: 11, color: '#ff9fb0', textShadow: '0 0 6px rgba(0,0,0,0.6)', background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: 6 }}>
                {id} ({Math.round(anchor.x)}, {Math.round(anchor.y)})
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
