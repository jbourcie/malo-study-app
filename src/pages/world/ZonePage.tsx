import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBiome } from '../../game/biomeCatalog'
import { getBlocksForBiome, type BiomeId } from '../../game/blockCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'
import { getTagMeta } from '../../taxonomy/tagCatalog'
import { getBlockVisualState, getZoneVisualState, type BlockVisualStateName } from '../../game/visualProgress'
import { zoneKey } from '../../game/rebuildService'

export function ZonePage() {
  const { biomeId, themeId } = useParams<{ biomeId: BiomeId, themeId: string }>()
  const theme = themeId ? decodeURIComponent(themeId) : null
  const biome = biomeId ? getBiome(biomeId) : null
  const { user } = useAuth()
  const { rewards, loading } = useUserRewards(user?.uid || null)
  const navigate = useNavigate()

  if (!biomeId || !biome || !theme) {
    return (
      <div className="container grid">
        <div className="card mc-card">
          <div className="small">Zone introuvable.</div>
          <button className="mc-button secondary" style={{ marginTop: 10 }} onClick={() => navigate('/world')}>← Retour carte</button>
        </div>
      </div>
    )
  }

  const blockProgress = rewards.blockProgress || {}
  const masteryByTag = rewards.masteryByTag || {}
  const zoneProgress = rewards.zoneRebuildProgress?.[zoneKey(biome.subject, theme)] || null

  const themeBlocks = getBlocksForBiome(biomeId).filter((b) => b.theme === theme)
  const blocks = themeBlocks.map((block) => {
    const meta = getTagMeta(block.tagId)
    const entry = blockProgress[block.tagId]
    const visual = getBlockVisualState({ ...(entry || {}), score: entry?.score ?? masteryByTag?.[block.tagId]?.score ?? 0 })
    return { ...block, label: meta.label, description: meta.description, visual }
  })

  const zoneVisual = getZoneVisualState(
    biome.subject,
    theme,
    blocks.map((b) => b.tagId),
    { blockProgress, masteryByTag },
    zoneProgress
  )

  const blockStateLabel: Record<BlockVisualStateName, string> = {
    locked: 'Verrouillé',
    beautified: 'Embelli',
    cracked: 'Fissuré',
    repaired: 'Réparé',
  }

  const blockTone: Record<BlockVisualStateName, string> = {
    locked: '',
    beautified: 'gold',
    cracked: '',
    repaired: 'accent',
  }

  const zoneLabel: Record<typeof zoneVisual.state, string> = {
    ruins: 'Ruines',
    building: 'En chantier',
    rebuilt_ready: 'Prête à reconstruire',
    rebuilding: 'Reconstruction en cours',
    rebuilt: 'Reconstruite',
  }

  const canRebuild = zoneVisual.state === 'rebuilt_ready' || zoneVisual.state === 'rebuilding'
  const rebuildProgressText = zoneVisual.rebuild
    ? `${zoneVisual.rebuild.correctCount}/${zoneVisual.rebuild.target}`
    : '0/35'

  return (
    <div className="container grid">
      <div className="card mc-card">
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <button className="mc-button secondary" onClick={() => navigate(`/world/${biomeId}`)}>← Retour biome</button>
          <div className="row" style={{ gap: 8, alignItems:'center' }}>
            <span className={`mc-chip ${zoneVisual.state === 'rebuilt_ready' || zoneVisual.state === 'rebuilt' ? 'gold' : zoneVisual.state === 'building' || zoneVisual.state === 'rebuilding' ? 'accent' : ''}`}>
              {zoneLabel[zoneVisual.state]}
            </span>
            <button
              className="mc-button"
              disabled={!canRebuild}
              title={canRebuild ? 'Lancer la reconstruction' : 'Stabilise d’abord les blocs'}
              onClick={() => {
                if (!canRebuild) return
                navigate(`/theme/reconstruction_${encodeURIComponent(theme)}?sessionKind=reconstruction_theme&subjectId=${biome.subject}&theme=${encodeURIComponent(theme)}`)
              }}
            >
              Reconstruire la zone
            </button>
          </div>
        </div>
        <h2 className="mc-title" style={{ marginTop: 10 }}>{biome.icon} {biome.name} · {theme}</h2>
        <div className="small" style={{ color:'var(--mc-muted)' }}>
          {blocks.length} blocs · stables {zoneVisual.breakdown.stablePct}% · patinés {zoneVisual.weatheredPct}% · Reconstruction {rebuildProgressText}
        </div>
        {zoneVisual.rebuild && (
          <div style={{ marginTop: 8 }}>
            <div className="small">Jauge : {zoneVisual.rebuild.correctCount}/{zoneVisual.rebuild.target}</div>
            <div style={{ background:'rgba(255,255,255,0.08)', border:'1px solid var(--mc-border)', borderRadius:6, height:10, overflow:'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round((zoneVisual.rebuild.correctCount / zoneVisual.rebuild.target) * 100))}%`, background:'var(--mc-accent)', height:'100%' }} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="block-card mc-card skeleton" />
          ))}
        </div>
      ) : !blocks.length ? (
        <div className="card mc-card">
          <div className="small">Aucun bloc pour cette zone.</div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {blocks.map((block) => {
            const chipTone = blockTone[block.visual.state] || ''
            const weathered = block.visual.weathered
            return (
              <div
                key={block.tagId}
                className={`block-card mc-card ${weathered ? 'block-weathered' : ''}`}
                style={{ position:'relative' }}
              >
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{block.label}</div>
                    <div className="small" style={{ color:'var(--mc-muted)' }}>{block.description || 'Description à venir.'}</div>
                  </div>
                  <span className={`mc-chip ${chipTone}`}>
                    {blockStateLabel[block.visual.state]}
                  </span>
                </div>
                <div className="row" style={{ marginTop: 8, gap: 10 }}>
                  <div className="small">Réussite : {block.visual.successRate}%</div>
                  <div className="small">Maîtrise : {block.visual.masteryScore}%</div>
                  <div className="small">Tentatives : {block.visual.attempts}</div>
                  {weathered && (
                    <span className="mc-chip muted">Patiné · 14j+</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
