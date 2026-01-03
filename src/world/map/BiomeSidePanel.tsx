import React from 'react'
import type { Biome } from '../../game/biomeCatalog'
import type { ZoneOverlayDef } from './resolveZoneAnchors'
import type { UserRewards } from '../../rewards/rewards'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { getMasteryState } from '../../game/worldHelpers'
import type { TagMeta } from '../../taxonomy/tagCatalog'

type BiomeSidePanelProps = {
  open: boolean
  biome: Biome | null
  zone: ZoneOverlayDef | null
  progress: { progressPct: number; correctCount: number; target: number; state: 'intact' | 'rebuilding' | 'rebuilt' | 'degraded' } | null
  tags: TagMeta[]
  rewards: UserRewards
  onClose: () => void
  onNavigateTheme: (theme: string) => void
  onNavigateTag: (tagId: string) => void
}

export function BiomeSidePanel({ open, biome, zone, progress, tags, rewards, onClose, onNavigateTheme, onNavigateTag }: BiomeSidePanelProps) {
  const isDesktop = useMedia('(min-width: 900px)')
  if (!open || !zone) return null

  const masteryByTag = rewards.masteryByTag || {}
  const blockProgress = rewards.blockProgress || {}

  return (
    <div
      style={{
        position: isDesktop ? 'relative' : 'fixed',
        top: isDesktop ? 0 : undefined,
        right: isDesktop ? 0 : undefined,
        bottom: isDesktop ? 0 : 0,
        width: isDesktop ? 'clamp(320px, 30vw, 460px)' : '100%',
        maxHeight: isDesktop ? '100%' : '70vh',
        background: isDesktop ? 'rgba(10,14,24,0.78)' : 'rgba(10,14,24,0.9)',
        backdropFilter: 'blur(8px)',
        borderLeft: isDesktop ? '1px solid rgba(255,255,255,0.12)' : undefined,
        boxShadow: isDesktop ? '-8px 0 20px rgba(0,0,0,0.35)' : '0 -8px 20px rgba(0,0,0,0.35)',
        padding: 16,
        overflowY: 'auto',
        zIndex: 1200,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>{biome?.name || ''}</div>
          <div style={{ fontWeight: 900 }}>{zone.themeLabel}</div>
        </div>
        <button className="mc-button secondary" onClick={onClose}>Fermer</button>
      </div>

      {progress && (
        <div className="mc-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Reconstruction</div>
          <div style={{ fontWeight: 800 }}>{progress.correctCount}/{progress.target} bonnes réponses</div>
          <div style={{ marginTop: 6 }}>
            <ProgressBar value={progress.progressPct} max={100} label={`${progress.progressPct}%`} />
          </div>
          <div className="small" style={{ color: 'var(--mc-muted)', marginTop: 6 }}>
            Etat : {progress.state === 'rebuilt' ? 'Reconstruite' : progress.state === 'rebuilding' ? 'En chantier' : progress.state === 'degraded' ? 'Patinée (14j+)' : 'Intacte'}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="mc-button" onClick={() => onNavigateTheme(zone.themeLabel)}>Lancer reconstruction</button>
          </div>
        </div>
      )}

      <div style={{ fontWeight: 900, marginTop: 6, marginBottom: 6 }}>Blocs de la zone</div>
      <div className="grid2">
        {tags.map((tag) => {
          const mastery = masteryByTag[tag.id]?.state || 'discovering'
          const visual = blockProgress[tag.id] || { attempts: 0, successRate: 0, score: masteryByTag[tag.id]?.score || 0 }
          const chipTone = mastery === 'mastered' ? 'gold' : mastery === 'progressing' ? 'accent' : 'muted'
          return (
            <div key={tag.id} className="mc-card" style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 800 }}>{tag.label}</div>
              <div className="small" style={{ color: 'var(--mc-muted)' }}>{tag.description}</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className={`mc-chip ${chipTone}`}>{mastery === 'mastered' ? 'Maîtrisé' : mastery === 'progressing' ? 'En progrès' : 'Découverte'}</span>
                <span className="mc-chip muted">Tentatives {visual.attempts || 0}</span>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <button className="mc-button secondary" onClick={() => onNavigateTag(tag.id)}>Session ciblée</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    setMatches(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}
