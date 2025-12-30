import React from 'react'
import { NPC_CATALOG } from '../../game/npc/npcCatalog'
import type { NpcId } from '../../game/npc/npcCatalog'
import type { DailyQuest } from '../../rewards/daily'
import { DAILY_QUEST_CONFIG } from '../../rewards/daily'

type Props = {
  npcId: NpcId
  quests: (DailyQuest & { npcLine?: string | null })[]
  onStart?: (quest?: DailyQuest | null) => void
  onChangeNpc: () => void
  loading?: boolean
  bonusAwarded?: boolean
  className?: string
}

const questIcons: Record<string, string> = {
  session: '📅',
  remediation: '🛠️',
  progress: '🚀',
}

export function NpcGuideCard({ npcId, quests, onStart, onChangeNpc, loading = false, bonusAwarded = false, className }: Props) {
  const npc = NPC_CATALOG[npcId]
  const allCompleted = quests.length > 0 && quests.every(q => q.completed)
  const primaryQuest = quests.find(q => q.tagId) || quests[0]

  return (
    <div className={`card mc-card ${className || ''}`}>
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

      {loading ? (
        <div className="mc-card" style={{ marginTop:12, border:'2px solid var(--mc-border)' }}>
          <div className="small" style={{ color:'var(--mc-muted)' }}>Chargement des quêtes du jour…</div>
        </div>
      ) : (
        <div className="mc-card" style={{ marginTop:12, border:'2px solid var(--mc-border)', display:'flex', flexDirection:'column', gap:10 }}>
          {quests.map((q) => {
            const pct = q.target ? Math.min(100, Math.round(((q.progress || 0) / q.target) * 100)) : 0
            return (
              <div key={q.id} className="mc-card" style={{ border:'1px solid var(--mc-border)', background:'rgba(255,255,255,0.03)' }}>
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:'1.2rem' }}>{questIcons[q.type || 'session'] || '🎯'}</div>
                    <div>
                      <div style={{ fontWeight:800 }}>{q.title}</div>
                      <div className="small" style={{ color:'var(--mc-muted)' }}>{q.tagHint || q.description}</div>
                    </div>
                  </div>
                  <div className="mc-chip">
                    <span style={{ fontWeight:700 }}>+{DAILY_QUEST_CONFIG.xpRewards[q.type || 'progress']} XP</span>
                  </div>
                </div>
                <div className="small" style={{ marginTop:6 }}>{q.npcLine || q.description}</div>
                <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:999, overflow:'hidden', marginTop:8 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:q.completed ? 'linear-gradient(90deg,#7fffb2,#2ecc71)' : 'linear-gradient(90deg,#7aa2ff,#2ecc71)', transition:'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}

          {allCompleted ? (
            <div className="pill" style={{ background:'rgba(126, 220, 134, 0.15)', border:'1px solid rgba(126,220,134,0.4)' }}>
              🎉 Quêtes terminées {bonusAwarded ? `• Bonus du jour +${DAILY_QUEST_CONFIG.xpRewards.dailyBonus} XP obtenu` : `• Bonus prêt (+${DAILY_QUEST_CONFIG.xpRewards.dailyBonus} XP)`}
            </div>
          ) : (
            <div className="small" style={{ color:'var(--mc-muted)' }}>Complète les 3 quêtes pour déclencher le bonus du jour.</div>
          )}
        </div>
      )}
    </div>
  )
}
