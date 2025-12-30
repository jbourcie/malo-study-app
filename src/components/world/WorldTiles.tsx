import React from 'react'
import type { Biome } from '../../game/biomeCatalog'
import type { BlockVisualStateName } from '../../game/visualProgress'
import { ProgressBar } from '../ui/ProgressBar'

export type MonumentState = 'locked' | 'building' | 'active'

export function getMonumentState(count: number, target: number): MonumentState {
  if (!count || count <= 0) return 'locked'
  if (count >= target) return 'active'
  return 'building'
}

export function MonumentBadge({ count, target }: { count: number; target: number }) {
  const state = getMonumentState(count, target)
  const tone = state === 'active' ? 'gold' : state === 'building' ? 'accent' : 'muted'
  const label = state === 'active' ? 'Actif' : state === 'building' ? 'En chantier' : 'Verrouillé'
  return (
    <span className={`mc-chip ${tone === 'gold' ? 'gold' : tone === 'accent' ? 'accent' : 'muted'}`}>
      🏛️ {label} · {count}/{target}
    </span>
  )
}

type BiomeTileProps = {
  biome: Biome
  totalBlocks: number
  masteredCount: number
  monumentCount: number
  target?: number
  onClick: () => void
  highlighted?: boolean
  className?: string
}

export function BiomeTile({ biome, totalBlocks, masteredCount, monumentCount, target = 100, onClick, highlighted = false, className }: BiomeTileProps) {
  const progress = totalBlocks > 0 ? Math.round((masteredCount / totalBlocks) * 100) : 0
  return (
    <div className={`card mc-card world-card ${className || ''}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
    }} style={highlighted ? { boxShadow: '0 0 24px rgba(122,162,255,0.55)', borderColor: 'rgba(122,162,255,0.8)' } : undefined}>
      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: '1.8rem' }}>{biome.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{biome.name}</div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>{biome.description}</div>
        </div>
        <MonumentBadge count={monumentCount} target={target} />
      </div>
      <div className="small" style={{ marginTop: 10 }}>
        Progression : {progress}% ({masteredCount}/{totalBlocks})
      </div>
      <ProgressBar value={progress} label="Maîtrise" />
      <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        <span className="small" style={{ color: 'var(--mc-muted)' }}>Entrer dans le biome</span>
        <span className="mc-chip accent">→</span>
      </div>
    </div>
  )
}

type ZoneTileProps = {
  theme: string
  blocksCount: number
  stablePct?: number
  weatheredPct?: number
  rebuild: { count: number; target: number }
  onClick: () => void
  highlighted?: boolean
  className?: string
}

export function ZoneTile({ theme, blocksCount, stablePct = 0, weatheredPct = 0, rebuild, onClick, highlighted = false, className }: ZoneTileProps) {
  const state = getMonumentState(rebuild.count, rebuild.target)
  const stateLabel = state === 'active' ? 'Reconstruite' : state === 'building' ? 'En chantier' : 'Ruines'
  return (
    <div className={`mc-card zone-card ${className || ''}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }} style={highlighted ? { boxShadow: '0 0 18px rgba(122,162,255,0.55)', borderColor: 'rgba(122,162,255,0.8)' } : undefined}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800 }}>{theme}</div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>{blocksCount} blocs · stables {stablePct}%</div>
          {weatheredPct > 0 && <div className="small" style={{ color: 'var(--mc-muted)' }}>Patinés {weatheredPct}%</div>}
        </div>
        <MonumentBadge count={rebuild.count} target={rebuild.target} />
      </div>
      <div style={{ marginTop: 6 }}>
        <ProgressBar value={rebuild.count} max={rebuild.target} label={`${stateLabel} (${rebuild.count}/${rebuild.target})`} tone={state === 'active' ? 'gold' : 'accent'} />
      </div>
      <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        <span className="small" style={{ color: 'var(--mc-muted)' }}>Ouvrir la zone</span>
        <span className="mc-chip accent">→</span>
      </div>
    </div>
  )
}

type BlockTileProps = {
  label: string
  description?: string | null
  visual: {
    state: BlockVisualStateName
    successRate: number
    masteryScore: number
    attempts: number
    weathered?: boolean
  }
  chip?: string
  onClick?: () => void
  selectable?: boolean
  className?: string
}

export function BlockTile({ label, description, visual, chip, onClick, selectable = true, className }: BlockTileProps) {
  const chipTone = visual.state === 'beautified' ? 'gold' : visual.state === 'repaired' ? 'accent' : ''
  return (
    <div
      className={`block-card mc-card ${visual.state === 'beautified' ? 'block-shiny' : visual.state === 'repaired' ? 'block-solid' : 'block-cracked'} ${visual.weathered ? 'block-weathered' : ''} ${className || ''}`}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : -1}
      onClick={selectable ? onClick : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      style={{ position: 'relative', cursor: selectable ? 'pointer' : 'default' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800 }}>{label}</div>
          {description ? <div className="small" style={{ color: 'var(--mc-muted)' }}>{description}</div> : null}
        </div>
        {chip && <span className={`mc-chip ${chipTone}`}>{chip}</span>}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 10 }}>
        <div className="small">Réussite : {visual.successRate}%</div>
        <div className="small">Maîtrise : {visual.masteryScore}%</div>
        <div className="small">Tentatives : {visual.attempts}</div>
        {visual.weathered && <span className="mc-chip muted">Patiné · 14j+</span>}
      </div>
    </div>
  )
}
