import React from 'react'
import type { Biome } from '../../game/biomeCatalog'
import { MonumentBadge, BlockTile } from './WorldTiles'
import { ProgressBar } from '../ui/ProgressBar'

type ZoneSummaryProps = {
  biome: Biome
  theme: string
  rebuild: { correctCount: number; target: number }
  weatheredPct?: number
  stablePct?: number
  onRebuild?: () => void
  canRebuild?: boolean
  className?: string
}

export function ZoneSummaryPanel({ biome, theme, rebuild, weatheredPct = 0, stablePct = 0, onRebuild, canRebuild, className }: ZoneSummaryProps) {
  const state = rebuild.correctCount >= rebuild.target ? 'Reconstruite' : rebuild.correctCount > 0 ? 'En chantier' : 'Ruines'
  return (
    <div className={`card mc-card ${className || ''}`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Zone</div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{biome.icon} {biome.name} · {theme}</div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>
            stables {stablePct}% · patinés {weatheredPct}% · {state}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
            <MonumentBadge count={rebuild.correctCount} target={rebuild.target} />
            {onRebuild && (
              <button
                className="mc-button"
                disabled={!canRebuild}
                onClick={onRebuild}
                title={canRebuild ? 'Lancer la reconstruction' : 'Stabilise d’abord les blocs'}
              >
                Reconstruire
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar value={rebuild.correctCount} max={rebuild.target} label={`Jauge ${rebuild.correctCount}/${rebuild.target}`} tone={rebuild.correctCount >= rebuild.target ? 'gold' : 'accent'} />
      </div>
    </div>
  )
}

type ZoneBlocksGridProps = {
  blocks: Array<{
    tagId: string
    label: string
    description?: string | null
    visual: {
      state: any
      successRate: number
      masteryScore: number
      attempts: number
      weathered?: boolean
    }
  }>
  onSelect?: (tagId: string) => void
  className?: string
}

export function ZoneBlocksGrid({ blocks, onSelect, className }: ZoneBlocksGridProps) {
  return (
    <div className="grid" style={{ gap: 12 }}>
      {blocks.map((block) => (
        <BlockTile
          key={block.tagId}
          label={block.label}
          description={block.description}
          visual={block.visual}
          chip={undefined}
          onClick={onSelect ? () => onSelect(block.tagId) : undefined}
          selectable={!!onSelect}
          className={className}
        />
      ))}
    </div>
  )
}
