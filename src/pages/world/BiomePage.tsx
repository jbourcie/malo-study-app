import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBiome } from '../../game/biomeCatalog'
import { getBlocksForBiome, type BiomeId } from '../../game/blockCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'
import { getMasteryState, stateToUiLabel } from '../../game/worldHelpers'
import type { MasteryState } from '../../rewards/rewards'
import { getTagMeta } from '../../taxonomy/tagCatalog'
import { getAvailableExpeditionsForBlock, type Expedition } from '../../game/expeditions'
import { shouldRepair } from '../../pedagogy/questionSelector'

export function BiomePage() {
  const { biomeId } = useParams<{ biomeId: BiomeId }>()
  const biome = biomeId ? getBiome(biomeId) : null
  const { user } = useAuth()
  const { rewards, loading } = useUserRewards(user?.uid || null)
  const navigate = useNavigate()
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)

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

  const selected = blocks.find(b => b.tagId === selectedBlockId) || null
  const expeditions: Expedition[] = selected
    ? getAvailableExpeditionsForBlock({
      tagId: selected.tagId,
      biomeId,
      masteryState: selected.masteryState,
      shouldRepair: shouldRepair(selected.tagId, []),
    })
    : []

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
          <div
            key={block.tagId}
            className={`block-card mc-card ${stateClass}`}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedBlockId(block.tagId)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBlockId(block.tagId) } }}
            style={{ cursor:'pointer', outline: selectedBlockId === block.tagId ? '2px solid var(--mc-accent)' : undefined }}
          >
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

      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }} role="dialog" aria-modal="true">
          <div className="card mc-card" style={{ maxWidth:520, width:'92%', maxHeight:'90vh', overflowY:'auto' }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:10 }}>
              <div>
                <div className="small" style={{ color:'var(--mc-muted)' }}>Bloc ciblé</div>
                <div style={{ fontWeight:900 }}>{selected.blockName}</div>
                <div className="small">{stateToUiLabel(selected.masteryState)}</div>
              </div>
              <button className="mc-button secondary" onClick={() => setSelectedBlockId(null)}>Fermer</button>
            </div>
            <div className="grid" style={{ gap:10, marginTop:12 }}>
              {expeditions.slice(0,3).map(exp => {
                const icon = exp.type === 'mine' ? '⛏️' : exp.type === 'repair' ? '🔧' : '🛠️'
                const label = exp.type === 'mine' ? 'Mine' : exp.type === 'repair' ? 'Réparer' : 'Artisanat'
                const goal = exp.type === 'mine'
                  ? 'Récolte et consolidation de ton bloc.'
                  : exp.type === 'repair'
                    ? 'Corriger les fissures : focus sur les erreurs récentes.'
                    : 'Combiner ce bloc avec un autre pour progresser.'
                return (
                  <div key={exp.type} className="mc-card" style={{ border:'2px solid var(--mc-border)' }}>
                    <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div style={{ fontSize:'1.4rem' }}>{icon}</div>
                        <div>
                          <div style={{ fontWeight:800 }}>{label} {exp.recommended ? '• recommandé' : ''}</div>
                          <div className="small" style={{ color:'var(--mc-muted)' }}>{goal}</div>
                        </div>
                      </div>
                      <div className="mc-chip">{exp.estimatedMinutes} min</div>
                    </div>
                    <button
                      className="mc-button"
                      style={{ marginTop:10, width:'100%' }}
                      onClick={() => navigate(`/theme/${biomeId}?expeditionType=${exp.type}&targetTagId=${selected.tagId}&biomeId=${biomeId}`)}
                    >
                      Commencer l’expédition
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
