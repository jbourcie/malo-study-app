import React from 'react'
import { getTagMeta } from '../../taxonomy/tagCatalog'

type BlockTileState = 'cracked' | 'repairing' | 'repaired' | 'enhanced'
type BlockTileVariant = 'overlay' | 'list'

type BlockTileProps = {
  tagId: string
  label: string
  state: BlockTileState
  masteryPct: number
  highlight?: boolean
  variant?: BlockTileVariant
  onStartSession?: () => void
}

export function BlockTile({
  tagId,
  label,
  state,
  masteryPct,
  highlight,
  variant = 'overlay',
  onStartSession,
}: BlockTileProps) {
  const resolvedLabel = label || getTagMeta(tagId).label || tagId
  const pct = Math.min(100, Math.max(0, Math.round(masteryPct || 0)))
  const classes = ['mc-blockTile', `mc-blockTile--${variant}`, `is-${state}`]
  if (highlight) classes.push('is-highlighted')
  const icon = state === 'cracked' ? '🧊' : state === 'repairing' ? '🛠️' : state === 'repaired' ? '✅' : '✨'

  return (
    <button
      className={classes.join(' ')}
      data-tag-id={tagId}
      aria-label={`Lancer le bloc ${resolvedLabel}, maîtrise ${pct}%`}
      title={`${resolvedLabel} (${pct}%)`}
      onClick={onStartSession}
    >
      <span className="mc-blockTile__icon" aria-hidden>{icon}</span>
      <span className="mc-blockTile__label">{resolvedLabel}</span>
      <span className="mc-blockTile__bar">
        <span className="mc-blockTile__barFill" style={{ width: `${pct}%` }} />
      </span>
      <span className="mc-blockTile__pct">{pct}%</span>
    </button>
  )
}
