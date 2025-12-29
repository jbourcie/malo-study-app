import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BIOMES_SORTED } from '../../game/biomeCatalog'
import { getBlocksForBiome } from '../../game/blockCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'
import { getBiomeVisualState } from '../../game/visualProgress'

export function WorldMapPage() {
  const { user } = useAuth()
  const { rewards, loading } = useUserRewards(user?.uid || null)
  const navigate = useNavigate()
  const blockProgress = rewards.blockProgress || {}
  const masteryByTag = rewards.masteryByTag || {}
  const zoneRebuildProgress = rewards.zoneRebuildProgress || {}
  const biomeRebuildProgress = rewards.biomeRebuildProgress || {}
  const biomeRebuildLabel: Record<string, string> = {
    not_ready: 'Pas prêt',
    ready: 'Prêt',
    rebuilding: 'En reconstruction',
    rebuilt: 'Reconstruit',
  }

  return (
    <div className="container grid">
      <div className="card mc-card">
        <h2 className="mc-title">Carte du monde MaloCraft</h2>
        <div className="small">Choisis un biome pour voir tes blocs, leur état et ta progression.</div>
      </div>

      <div className="grid2">
        {BIOMES_SORTED.map((biome) => {
          const blocks = getBlocksForBiome(biome.id)
          const masteredCount = blocks.filter(
            (block) => rewards.masteryByTag?.[block.tagId]?.state === 'mastered'
          ).length
          const total = blocks.length
          const progression = !loading && total > 0 ? Math.round((masteredCount / total) * 100) : null
          const byTheme: Record<string, string[]> = {}
          blocks.forEach(b => {
            if (!byTheme[b.theme]) byTheme[b.theme] = []
            byTheme[b.theme].push(b.tagId)
          })
          const zones = Object.entries(byTheme).map(([theme, tagIds]) => ({ theme, tagIds }))
          const biomeVisual = getBiomeVisualState(
            biome.subject,
            zones,
            { blockProgress, masteryByTag },
            { zoneRebuildProgress, biomeRebuild: biomeRebuildProgress[biome.subject] }
          )
          const rebuiltZones = biomeVisual.rebuild?.rebuiltZones || 0
          const totalZones = biomeVisual.rebuild?.totalZones || zones.length
          const rebuildGauge = Math.min(100, Math.round(((biomeVisual.rebuild?.correctCount || 0) / (biomeVisual.rebuild?.target || 100)) * 100))

          return (
            <div
              key={biome.id}
              className="card mc-card world-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/world/${biome.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/world/${biome.id}`)
                }
              }}
            >
              <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '1.8rem' }}>{biome.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize:'1.1rem' }}>{biome.name}</div>
                  <div className="small" style={{ color:'var(--mc-muted)' }}>{biome.description}</div>
                </div>
                <div className="mc-chip accent">{total || 0} blocs</div>
              </div>
              <div className="small" style={{ marginTop: 10 }}>
                Progression : {progression !== null ? `${progression}% (${masteredCount}/${total})` : '—'}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Zones reconstruites : {rebuiltZones}/{totalZones} · Biome {biomeRebuildLabel[biomeVisual.rebuild?.status || 'not_ready']}
              </div>
              <div style={{ background:'rgba(255,255,255,0.08)', border:'1px solid var(--mc-border)', borderRadius:6, height:10, overflow:'hidden', marginTop:6 }}>
                <div style={{ width: `${rebuildGauge}%`, background:'var(--mc-accent)', height:'100%' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
