import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBiome } from '../../game/biomeCatalog'
import { getBlocksForBiome, type BiomeId } from '../../game/blockCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'
import { getMasteryState, stateToUiLabel } from '../../game/worldHelpers'
import type { MasteryState } from '../../rewards/rewards'
import { getTagMeta } from '../../taxonomy/tagCatalog'

export function BiomePage() {
  const { biomeId } = useParams<{ biomeId: BiomeId }>()
  const biome = biomeId ? getBiome(biomeId) : null
  const { user } = useAuth()
  const { rewards, loading } = useUserRewards(user?.uid || null)
  const navigate = useNavigate()

  if (!biomeId || !biome) {
    return (
      <div className="container grid">
        <div className="card mc-card">
          <div className="small">Biome introuvable.</div>
          <button className="mc-button secondary" style={{ marginTop: 10 }} onClick={() => navigate('/world')}>← Retour carte</button>
        </div>
      </div>
    )
  }

  const masteryByTag = rewards.masteryByTag || {}
  const stateOrder: Record<MasteryState, number> = { mastered: 0, progressing: 1, discovering: 2 }
  const blocks = getBlocksForBiome(biomeId)
    .map((block) => {
      const meta = getTagMeta(block.tagId)
      const masteryState = getMasteryState(masteryByTag, block.tagId)
      return { ...block, masteryState, description: meta.description }
    })
    .sort((a, b) => {
      const stateDiff = (stateOrder[a.masteryState] ?? 2) - (stateOrder[b.masteryState] ?? 2)
      if (stateDiff !== 0) return stateDiff
      const themeDiff = a.theme.localeCompare(b.theme)
      if (themeDiff !== 0) return themeDiff
      return a.blockName.localeCompare(b.blockName)
    })

  return (
    <div className="container grid">
      <div className="card mc-card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="mc-button secondary" onClick={() => navigate('/world')}>← Retour carte</button>
          <div className="mc-chip accent">{blocks.length} blocs</div>
        </div>
        <h2 className="mc-title" style={{ marginTop: 10 }}>{biome.icon} {biome.name}</h2>
        <div className="small" style={{ color:'var(--mc-muted)' }}>{biome.description}</div>
      </div>

      {loading ? (
        <div className="grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="block-card mc-card skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {blocks.map((block) => {
            const stateClass =
              block.masteryState === 'mastered' ? 'block-shiny' :
              block.masteryState === 'progressing' ? 'block-solid' : 'block-cracked'
            const chipTone = block.masteryState === 'mastered' ? 'gold' : block.masteryState === 'progressing' ? 'accent' : ''
            return (
            <div key={block.tagId} className={`block-card mc-card ${stateClass}`}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{block.blockName}</div>
                  <div className="small" style={{ color:'var(--mc-muted)' }}>{block.description || 'Description à venir.'}</div>
                </div>
                <span className={`mc-chip ${chipTone}`}>
                  {block.masteryState === 'mastered' ? '🟨' : block.masteryState === 'progressing' ? '🟩' : '🟫'} {stateToUiLabel(block.masteryState)}
                </span>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
