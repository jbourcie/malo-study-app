import React from 'react'
import type { BlockVisualState } from './progressionStates'

type PoiInfoPanelProps = {
  open: boolean
  label: string
  masteryPct: number
  state?: BlockVisualState
  onClose: () => void
  onStart?: () => void
  entityLabel?: string
  metricLabel?: string
}

export function PoiInfoPanel({
  open,
  label,
  masteryPct,
  state,
  onClose,
  onStart,
  entityLabel = 'Bloc',
  metricLabel = 'Maîtrise',
}: PoiInfoPanelProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="mc-poiPanel" role="dialog" aria-label={`${entityLabel} ${label}`} ref={ref}>
      <div className="mc-poiPanel__header">
        <div className="mc-poiPanel__title">{label}</div>
        <button className="mc-poiPanel__close" aria-label="Fermer" onClick={onClose}>✕</button>
      </div>
      <div className="mc-poiPanel__body">
        <div className="mc-poiPanel__meter">
          <div className="mc-poiPanel__bar"><span style={{ width: `${Math.min(100, Math.max(0, masteryPct))}%` }} /></div>
          <div className="mc-poiPanel__meta">{metricLabel} {Math.round(masteryPct)}% {state ? `· ${state}` : ''}</div>
        </div>
        {onStart && (
          <button className="mc-button" onClick={() => { onStart(); onClose() }}>Lancer une session</button>
        )}
      </div>
    </div>
  )
}
