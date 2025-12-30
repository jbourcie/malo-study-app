import React from 'react'
import { listInventory } from '../data/rewards'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { useDailyQuests } from '../state/useDailyQuests'
import type { DailyQuest } from '../rewards/daily'
import { BADGES } from '../rewards/badgesCatalog'
import { listLast7Days } from '../stats/dayLog'
import { useNavigate } from 'react-router-dom'
import { getPreferredNpcId, setPreferredNpcId } from '../game/npc/npcStorage'
import { NpcPickerModal } from '../components/game/NpcPickerModal'
import { NpcGuideCard } from '../components/game/NpcGuideCard'
import { BIOMES_SORTED } from '../game/biomeCatalog'
import { getBlocksForBiome } from '../game/blockCatalog'
import { getNpcLine } from '../game/npc/npcDialogue'

export function HomePage() {
  const { user, activeChild } = useAuth()
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const { daily, loading: loadingDaily } = useDailyQuests(playerUid)
  const nav = useNavigate()
  const [showNpcPicker, setShowNpcPicker] = React.useState(false)
  const [npcId, setNpcId] = React.useState(getPreferredNpcId())
  const [inventory, setInventory] = React.useState<any[]>([])
  const [days, setDays] = React.useState<any[]>([])
  const [npcMessage, setNpcMessage] = React.useState<string>('')
  const streakFlames = React.useMemo(() => {
    const sorted = [...days].sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''))
    let streak = 0
    for (const d of sorted) {
      if ((d.sessions || 0) > 0) {
        streak += 1
      } else {
        break
      }
    }
    return streak
  }, [days])

  const questsWithLines = React.useMemo(() => {
    if (!daily) return []
    return (daily.quests || []).map((q) => {
      const reason = q.type === 'remediation' ? 'repair' : q.type === 'progress' ? 'priority' : 'spaced'
      const line = getNpcLine(npcId, 'daily_quest', { reasonCode: reason }).text
      return { ...q, npcLine: line }
    })
  }, [daily?.dateKey, npcId])

  const allDailyCompleted = React.useMemo(() => (daily?.quests || []).every(q => q.completed), [daily?.quests])

  const onStartMission = (quest?: DailyQuest | null) => {
    const targetQuest = quest || questsWithLines.find(q => q.tagId) || null
    const targetTag = targetQuest?.tagId
    if (targetTag) {
      const params = new URLSearchParams()
      params.set('expeditionType', targetQuest?.type === 'remediation' ? 'repair' : 'mine')
      params.set('targetTagId', targetTag)
      nav(`/theme/expedition?${params.toString()}`)
    } else {
      setNpcMessage('On s’entraîne un peu aujourd’hui, puis on reviendra sur des notions plus ciblées.')
      nav('/world')
    }
  }

  React.useEffect(() => {
    if (!playerUid) return
    (async () => {
      try {
        const inv = await listInventory(playerUid)
        setInventory(inv)
      } catch (e) {
        // ignore inventory errors for now
      }
      try {
        const last = await listLast7Days(playerUid)
        setDays(last)
      } catch (e) {
        // ignore streak errors for now
      }
    })()
  }, [playerUid])

  React.useEffect(() => {
    if (loadingDaily) return
    if (!daily) {
      setNpcMessage('Quêtes indisponibles pour le moment.')
    } else {
      setNpcMessage('')
    }
  }, [daily, loadingDaily])

  if (!playerUid) {
    return (
      <div className="container">
        <div className="card">Sélectionnez un enfant rattaché pour accéder à l’accueil.</div>
      </div>
    )
  }

  return (
    <div className="container grid">
      <div className="card">
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>Salut {activeChild?.displayName || 'Malo'} 👋</h2>
            <div className="small">Pars sur la carte du monde, choisis un biome et progresse bloc par bloc.</div>
            <div className="small" style={{ marginTop: 6 }}>Niveau {rewards.level || 1} · XP {rewards.xp || 0}</div>
            {(rewards.badges || []).length ? (
              <div className="row" style={{ marginTop: 6, gap: 6 }}>
                {rewards.badges?.map((b: string) => {
                  const def = BADGES.find(x => x.id === b)
                  return (
                    <span key={b} className="pill" style={{ padding:'4px 8px', border:'1px solid rgba(255,255,255,0.2)' }}>
                      {def?.icon || '🏅'} {def?.title || b}
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
          {streakFlames > 0 && (
            <div className="pill" style={{ alignSelf:'flex-start' }}>
              🔥 Streak {streakFlames} j
            </div>
          )}
        </div>
        {npcMessage && <div className="small" style={{ marginTop:8, color:'#ffb347' }}>{npcMessage}</div>}
      </div>

      {daily ? (
        allDailyCompleted ? (
          <div className="card mc-card">
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:10 }}>
              <div>
                <div className="small" style={{ color:'var(--mc-muted)' }}>Quêtes du jour</div>
                <div style={{ fontWeight:900 }}>Quêtes journalières terminées</div>
                <div className="small" style={{ color:'var(--mc-muted)', marginTop:4 }}>
                  Tu as déjà complété les 3 quêtes aujourd’hui. Reviens demain pour de nouvelles missions !
                </div>
              </div>
              <button className="mc-button secondary" onClick={() => setShowNpcPicker(true)}>Changer de guide</button>
            </div>
          </div>
        ) : (
          <NpcGuideCard
            npcId={npcId}
            quests={questsWithLines}
            bonusAwarded={daily.bonusAwarded}
            loading={loadingDaily}
            onStart={onStartMission}
            onChangeNpc={() => setShowNpcPicker(true)}
          />
        )
      ) : (
        <div className="card mc-card">
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>Guide Malo</div>
              <div style={{ fontWeight:900 }}>Quêtes du jour</div>
              <div className="small" style={{ color:'var(--mc-muted)', marginTop:4 }}>
                {loadingDaily ? 'Chargement…' : 'Aucune quête du jour disponible pour l’instant.'}
              </div>
            </div>
            <button className="mc-button secondary" onClick={() => setShowNpcPicker(true)}>Changer de guide</button>
          </div>
          <div className="mc-card" style={{ marginTop:12, border:'2px solid var(--mc-border)' }}>
            <div className="small" style={{ color:'var(--mc-muted)' }}>
              Dès qu’une mission est disponible, elle apparaîtra ici.
            </div>
          </div>
        </div>
      )}

      {/* Carte du monde déjà accessible, on conserve juste les biomes */}

      <div className="grid2">
        {BIOMES_SORTED.map((biome) => {
          const blocks = getBlocksForBiome(biome.id)
          const masteredCount = blocks.filter(
            (block) => rewards.masteryByTag?.[block.tagId]?.state === 'mastered'
          ).length
          const total = blocks.length
          const progression = total > 0 ? Math.round((masteredCount / total) * 100) : 0
          return (
            <div key={biome.id} className="card mc-card world-card">
              <div className="row" style={{ alignItems:'center', gap:10 }}>
                <div style={{ fontSize:'1.6rem' }}>{biome.icon}</div>
                <div>
                  <div style={{ fontWeight:800 }}>{biome.name}</div>
                  <div className="small" style={{ color:'var(--mc-muted)' }}>{biome.description}</div>
                </div>
                <div className="mc-chip">{progression}%</div>
              </div>
              <button className="mc-button secondary" style={{ marginTop:10 }} onClick={() => nav(`/world/${biome.id}`)}>
                Ouvrir le biome
              </button>
            </div>
          )
        })}
      </div>

      {inventory.length ? (
        <div className="card">
          <h3 style={{ marginTop:0 }}>Inventaire</h3>
          <div className="row">
            {inventory.map((item: any) => (
              <span key={item.id} className="badge">{item.title || item.id}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop:0 }}>Badges</h3>
        <div className="grid2">
          {BADGES.map(b => {
            const unlocked = (rewards.badges || []).includes(b.id)
            return (
              <div key={b.id} className="pill" style={{
                opacity: unlocked ? 1 : 0.35,
                borderColor: unlocked ? 'rgba(122,162,255,0.6)' : 'rgba(255,255,255,0.18)',
                display:'flex', flexDirection:'column', gap:4
              }}>
                <div style={{ fontWeight: 700 }}>{b.icon} {b.title}</div>
                <div className="small">{b.description}</div>
              </div>
            )
          })}
        </div>
      </div>

      <NpcPickerModal
        open={showNpcPicker}
        onClose={() => setShowNpcPicker(false)}
        onPicked={(id) => {
          setNpcId(id)
          setPreferredNpcId(id)
          setShowNpcPicker(false)
        }}
      />
    </div>
  )
}
