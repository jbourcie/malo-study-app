import React from 'react'

type ZoneMonumentChipProps = {
  label: string
  progress0to100: number
  state: 'intact' | 'rebuilding' | 'rebuilt' | 'degraded'
  highlighted?: boolean
  onClick?: () => void
}

export function ZoneMonumentChip({ label, progress0to100, state, highlighted, onClick }: ZoneMonumentChipProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress0to100)))
  const classes = ['zone-monument-chip', `zone-${state}`]
  if (state === 'degraded') classes.push('is-weathered')
  if (highlighted) classes.push('is-highlighted')
  return (
    <div
      className={classes.join(' ')}
      aria-label={`Ouvrir la zone ${label}, progression ${pct}%`}
      title={`Ouvrir la zone ${label} (${pct}%)`}
      style={{
        minWidth: 36,
        padding: 6,
        borderRadius: 10,
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.14)',
        color: '#fff',
        fontSize: 12,
        boxShadow: highlighted ? '0 0 12px rgba(122,162,255,0.6)' : '0 2px 6px rgba(0,0,0,0.4)',
        pointerEvents: onClick ? 'auto' : 'none',
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <div style={{ width: 40, height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: state === 'rebuilt' ? '#7fc4a3' : state === 'rebuilding' ? '#7aa2ff' : 'rgba(255,255,255,0.5)' }} />
        </div>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>
    </div>
  )
}
