import React from 'react'

type Props = {
  value: number
  max?: number
  label?: string
  tone?: 'default' | 'accent' | 'gold'
}

export function ProgressBar({ value, max = 100, label, tone = 'default' }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  const color = tone === 'gold' ? '#f1c66d' : tone === 'accent' ? 'var(--mc-accent)' : '#7aa2ff'
  return (
    <div>
      {label && <div className="small" style={{ color: 'var(--mc-muted)' }}>{label}</div>}
      <div style={{
        height: 10,
        background: 'rgba(255,255,255,0.16)',
        borderRadius: 999,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color})`,
          boxShadow: '0 0 10px rgba(255,255,255,0.18)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}
