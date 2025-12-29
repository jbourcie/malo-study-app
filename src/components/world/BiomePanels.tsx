import React from 'react'
import type { Biome } from '../../game/biomeCatalog'
import type { Expedition } from '../../game/expeditions'
import type { MasteryState } from '../../rewards/rewards'
import { stateToUiLabel } from '../../game/worldHelpers'
import { MonumentBadge, ZoneTile, BlockTile } from './WorldTiles'
import { ProgressBar } from '../ui/ProgressBar'

export type ZoneViewModel = {
  theme: string
  tagIds: string[]
  blocks: Array<{
    tagId: string
    blockName: string
    description?: string | null
    masteryState: MasteryState
    visual: {
      state: any
      successRate: number
      masteryScore: number
      attempts: number
      weathered?: boolean
    }
  }>
  visual: {
    state: string
    weatheredPct: number
    breakdown: { stablePct: number }
    rebuild?: { correctCount: number; target: number }
  }
}

type BiomeSummaryProps = {
  biome: Biome
  rebuild: { correctCount: number; target: number; statusLabel: string }
  onRebuild?: () => void
  canRebuild?: boolean
}

export function BiomeSummaryPanel({ biome, rebuild, onRebuild, canRebuild }: BiomeSummaryProps) {
  return (
    <div className="card mc-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Biome</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{biome.icon} {biome.name}</div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>{biome.description}</div>
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <MonumentBadge count={rebuild.correctCount} target={rebuild.target} />
            <span className="mc-chip">{rebuild.statusLabel}</span>
          </div>
        </div>
        {onRebuild && (
          <button className="mc-button" disabled={!canRebuild} onClick={onRebuild} title={canRebuild ? 'Reconstruire le biome' : 'Reconstruis d’abord les zones'}>
            Reconstruire
          </button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <ProgressBar value={rebuild.correctCount} max={rebuild.target} label={`Jauge ${rebuild.correctCount}/${rebuild.target}`} tone={rebuild.correctCount >= rebuild.target ? 'gold' : 'accent'} />
      </div>
    </div>
  )
}

type ZoneTilesGridProps = {
  zones: ZoneViewModel[]
  onSelect: (theme: string) => void
  highlightedTheme?: string | null
}

export function ZoneTilesGrid({ zones, onSelect, highlightedTheme }: ZoneTilesGridProps) {
  return (
    <div className="card mc-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Zones du biome</div>
          <div style={{ fontWeight: 800 }}>État des zones ({zones.length})</div>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 10 }}>
        {zones.map((zone) => (
          <ZoneTile
            key={zone.theme}
            theme={zone.theme}
            blocksCount={zone.blocks.length}
            stablePct={zone.visual.breakdown.stablePct}
            weatheredPct={zone.visual.weatheredPct}
            rebuild={{ count: zone.visual.rebuild?.correctCount || 0, target: zone.visual.rebuild?.target || 35 }}
            onClick={() => onSelect(zone.theme)}
            highlighted={highlightedTheme === zone.theme}
          />
        ))}
      </div>
    </div>
  )
}

type BlockGridProps = {
  blocks: ZoneViewModel['blocks']
  availability: Record<string, boolean>
  selectedBlockId?: string | null
  onSelect: (tagId: string) => void
}

export function BlockGrid({ blocks, availability, selectedBlockId, onSelect }: BlockGridProps) {
  return (
    <div className="grid" style={{ gap: 12 }}>
      {blocks.map((block) => {
        const hasQuestions = availability[block.tagId] !== false
        const chipTone = block.masteryState === 'mastered' ? 'gold' : block.masteryState === 'progressing' ? 'accent' : ''
        return (
          <BlockTile
            key={block.tagId}
            label={block.blockName}
            description={block.description}
            visual={block.visual}
            chip={`${block.masteryState === 'mastered' ? '🟨' : block.masteryState === 'progressing' ? '🟩' : '🟫'} ${stateToUiLabel(block.masteryState)}`}
            onClick={() => hasQuestions && onSelect(block.tagId)}
            selectable={hasQuestions}
          />
        )
      })}
    </div>
  )
}

type BlockActionsProps = {
  blockName: string
  masteryLabel: string
  expeditions: Expedition[]
  biomeId?: string
  onStart: (expeditionType: string) => void
  onClose: () => void
}

export function BlockActionsPanel({ blockName, masteryLabel, expeditions, onStart, onClose }: BlockActionsProps) {
  return (
    <div className="card mc-card" style={{ maxWidth: 520 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Bloc ciblé</div>
          <div style={{ fontWeight: 900 }}>{blockName}</div>
          <div className="small">{masteryLabel}</div>
        </div>
        <button className="mc-button secondary" onClick={onClose}>Fermer</button>
      </div>
      <div className="grid" style={{ gap: 10, marginTop: 12 }}>
        {expeditions.slice(0, 3).map(exp => {
          const icon = exp.type === 'mine' ? '⛏️' : exp.type === 'repair' ? '🔧' : '🛠️'
          const label = exp.type === 'mine' ? 'Mine' : exp.type === 'repair' ? 'Réparer' : 'Artisanat'
          const goal = exp.type === 'mine'
            ? 'Récolte et consolidation de ton bloc.'
            : exp.type === 'repair'
              ? 'Corriger les fissures : focus sur les erreurs récentes.'
              : 'Combiner ce bloc avec un autre pour progresser.'
          return (
            <div key={exp.type} className="mc-card" style={{ border: '2px solid var(--mc-border)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: '1.4rem' }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>{label} {exp.recommended ? '• recommandé' : ''}</div>
                    <div className="small" style={{ color: 'var(--mc-muted)' }}>{goal}</div>
                  </div>
                </div>
                <div className="mc-chip">{exp.estimatedMinutes} min</div>
              </div>
              <button
                className="mc-button"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => onStart(exp.type)}
              >
                Commencer l’expédition
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
