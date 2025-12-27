import React from 'react'
import { Link } from 'react-router-dom'
import { listInventory } from '../data/rewards'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { BADGES } from '../rewards/badgesCatalog'
import { listLast7Days } from '../stats/dayLog'
import { useNavigate } from 'react-router-dom'
import { getPreferredNpcId, setPreferredNpcId, getOrCreateDailyRecommendation, setDailyRecommendation, setDailyRerollUsed, getDailyRerollUsed, clearDailyRecommendation, getDailyRecommendation } from '../game/npc/npcStorage'
import { NpcPickerModal } from '../components/game/NpcPickerModal'
import { NpcGuideCard } from '../components/game/NpcGuideCard'
import { buildNpcRecommendation, formatDateKeyParis } from '../game/npc/npcRecommendation'
import type { NpcRecommendation } from '../game/npc/npcRecommendation'
import { BIOMES_SORTED } from '../game/biomeCatalog'
import { getBlocksForBiome } from '../game/blockCatalog'

export function HomePage() {
  const { user } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const nav = useNavigate()
  const [showNpcPicker, setShowNpcPicker] = React.useState(false)
  const [npcId, setNpcId] = React.useState(getPreferredNpcId())
  const [recommendation, setRecommendation] = React.useState<NpcRecommendation | null>(null)
  const [inventory, setInventory] = React.useState<any[]>([])
  const [days, setDays] = React.useState<any[]>([])
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

  const dateKey = formatDateKeyParis(Date.now())

  const onReroll = () => {
    if (getDailyRerollUsed(dateKey)) return
    const masteryByTag = rewards?.masteryByTag || {}
    const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = []
    const previousTag = recommendation?.expedition.targetTagId
    const filteredMastery = { ...masteryByTag }
    if (previousTag) delete (filteredMastery as any)[previousTag]
    const rec = buildNpcRecommendation({ npcId, masteryByTag: filteredMastery, history, nowTs: Date.now(), excludeTagIds: previousTag ? [previousTag] : [] })
    if (rec) {
      setRecommendation(rec)
      setDailyRecommendation(dateKey, rec)
      setDailyRerollUsed(dateKey)
    }
  }

  const onStartMission = () => {
    if (!recommendation) return
    const exp = recommendation.expedition
    const params = new URLSearchParams()
    params.set('expeditionType', exp.type)
    params.set('targetTagId', exp.targetTagId)
    params.set('biomeId', exp.biomeId)
    if (exp.secondaryTagIds?.length) params.set('secondaryTagIds', exp.secondaryTagIds.join(','))
    nav(`/theme/expedition?${params.toString()}`)
  }

  React.useEffect(() => {
    if (!user) return
    (async () => {
      try {
        const inv = await listInventory(user.uid)
        setInventory(inv)
      } catch (e) {
        console.error('stats/inventory failed', e)
      }
      try {
        const last = await listLast7Days(user.uid)
        setDays(last)
      } catch (e) {
        console.warn('days stats indisponibles', e)
      }
    })()
  }, [user])

  React.useEffect(() => {
    const dateKey = formatDateKeyParis(Date.now())
    const masteryByTag = rewards?.masteryByTag || {}
    const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = [] // TODO: branch to real history si disponible
    const stored = getDailyRecommendation(dateKey)
    let rec = stored && stored.npcId === npcId ? stored : null
    if (!rec) {
      clearDailyRecommendation(dateKey)
      rec = getOrCreateDailyRecommendation({
        npcId,
        masteryByTag,
        history,
        nowTs: Date.now(),
      })
    }
    if (!rec) {
      rec = buildNpcRecommendation({ npcId, masteryByTag, history, nowTs: Date.now() })
      if (rec) setDailyRecommendation(dateKey, rec)
    }
    setRecommendation(rec)
    if (process.env.NODE_ENV !== 'production' && rec) {
      console.debug('[npc.mission]', { npcId, reason: rec.reasonCode, tag: rec.expedition.targetTagId, type: rec.expedition.type })
    }
  }, [npcId, rewards])

  return (
    <div className="container grid">
      <div className="card">
        <div className="row" style={{ justifyContent:'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>Salut Malo 👋</h2>
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
      </div>

      {recommendation && (
        <NpcGuideCard
          recommendation={recommendation}
          dateKey={dateKey}
          onStart={onStartMission}
          onReroll={onReroll}
          onChangeNpc={() => setShowNpcPicker(true)}
        />
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
          const masteryByTag = rewards?.masteryByTag || {}
          const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = []
          const rec = buildNpcRecommendation({ npcId: id, masteryByTag, history, nowTs: Date.now() })
          if (rec) {
            setDailyRecommendation(dateKey, rec)
            setRecommendation(rec)
          } else {
            clearDailyRecommendation(dateKey)
            setRecommendation(null)
          }
        }}
      />
    </div>
  )
}
