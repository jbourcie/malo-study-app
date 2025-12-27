import React from 'react'
import { NPC_CATALOG } from '../../game/npc/npcCatalog'
import type { NpcRecommendation } from '../../game/npc/npcRecommendation'
import { getBlockDef } from '../../game/blockCatalog'
import { getDailyRerollUsed } from '../../game/npc/npcStorage'

type Props = {
  recommendation: NpcRecommendation
  dateKey: string
  onStart: () => void
  onReroll: () => void
  onChangeNpc: () => void
  rerollCount?: number
  rerollLimit?: number
}

const expeditionLabels: Record<string, string> = {
  mine: '⛏️ Miner',
  repair: '🔧 Réparer',
  craft: '🛠️ Crafter',
}

export function NpcGuideCard({ recommendation, dateKey, onStart, onReroll, onChangeNpc, rerollCount = 0, rerollLimit = 1 }: Props) {
  const npc = NPC_CATALOG[recommendation.npcId]
  const rerollUsed = getDailyRerollUsed(dateKey)
  const targetBlock = getBlockDef(recommendation.expedition.targetTagId)
  const secondaryLabels = (recommendation.expedition.secondaryTagIds || []).map(id => getBlockDef(id).blockName)
  const remaining = Math.max(0, rerollLimit - rerollCount)

  return (
    <div className="card mc-card">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:'2rem' }}>{npc.avatar}</div>
          <div>
            <div style={{ fontWeight:900 }}>{npc.name}</div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>{npc.shortTagline}</div>
          </div>
        </div>
        <button className="mc-button secondary" onClick={onChangeNpc}>Changer de guide</button>
      </div>

      <div style={{ marginTop:10 }}>
        <div className="small" style={{ color:'var(--mc-muted)' }}>{recommendation.title}</div>
        <div style={{ fontWeight:800, marginTop:4 }}>{recommendation.message}</div>
      </div>

      <div className="mc-card" style={{ marginTop:12, border:'2px solid var(--mc-border)' }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:800 }}>{expeditionLabels[recommendation.expedition.type]}</div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>
              Bloc : {targetBlock.blockName}{secondaryLabels.length ? ` + ${secondaryLabels.join(', ')}` : ''}
            </div>
          </div>
          <div className="mc-chip">{recommendation.expedition.estimatedMinutes} min</div>
        </div>
        <div className="row" style={{ gap:8, marginTop:10, flexWrap:'wrap' }}>
          <button className="mc-button" onClick={onStart}>Lancer la mission</button>
          <button className="mc-button secondary" onClick={onReroll}>
            {remaining <= 0 || rerollUsed ? 'Mission déjà changée' : 'Changer de mission'}
          </button>
        </div>
        <div className="small" style={{ marginTop:6, color:'var(--mc-muted)' }}>
          Changements restants : {remaining}
        </div>
      </div>
    </div>
  )
}
