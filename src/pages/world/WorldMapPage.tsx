import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BIOMES_SORTED } from '../../game/biomeCatalog'
import { getBlocksForBiome } from '../../game/blockCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'

export function WorldMapPage() {
  const { user } = useAuth()
  const { rewards, loading } = useUserRewards(user?.uid || null)
  const navigate = useNavigate()

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
            </div>
          )
        })}
      </div>
    </div>
  )
}
