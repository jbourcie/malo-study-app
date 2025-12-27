import React from 'react'
import { Link } from 'react-router-dom'
import { listInventory } from '../data/rewards'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { BADGES } from '../rewards/badgesCatalog'
import { getDailyState } from '../rewards/daily'
import { listLast7Days } from '../stats/dayLog'
import { useNavigate } from 'react-router-dom'
import { getPreferredNpcId, setPreferredNpcId, getOrCreateDailyRecommendation, setDailyRecommendation, setDailyRerollUsed, getDailyRerollUsed } from '../game/npc/npcStorage'
import { NpcPickerModal } from '../components/game/NpcPickerModal'
import { NpcGuideCard } from '../components/game/NpcGuideCard'
import { buildNpcRecommendation, formatDateKeyParis } from '../game/npc/npcRecommendation'
import type { NpcRecommendation } from '../game/npc/npcRecommendation'

export function HomePage() {
  const { user } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const nav = useNavigate()
  const [showNpcPicker, setShowNpcPicker] = React.useState(false)
  const [npcId, setNpcId] = React.useState(getPreferredNpcId())
  const [recommendation, setRecommendation] = React.useState<NpcRecommendation | null>(null)
  const [inventory, setInventory] = React.useState<any[]>([])
  const [daily, setDaily] = React.useState<any | null>(null)
  const [days, setDays] = React.useState<any[]>([])

  const dateKey = formatDateKeyParis(Date.now())

  const onReroll = () => {
    if (getDailyRerollUsed(dateKey)) return
    const masteryByTag = rewards?.masteryByTag || {}
    const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = []
    const previousTag = recommendation?.expedition.targetTagId
    const filteredMastery = { ...masteryByTag }
    if (previousTag) delete (filteredMastery as any)[previousTag]
    const rec = buildNpcRecommendation({ npcId, masteryByTag: filteredMastery, history, nowTs: Date.now() })
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
        const d = await getDailyState(user.uid)
        setDaily(d)
      } catch (e) {
        console.warn('daily quests indisponibles (fallback local)', e)
        setDaily({
          dateKey: new Date().toISOString().slice(0, 10),
          quests: [
            { id: 'session_one', title: 'Faire 1 séance', description: '', target: 1, progress: 0, completed: false },
            { id: 'answer_ten', title: 'Répondre à 10 questions', description: '', target: 10, progress: 0, completed: false },
          ],
        })
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
    const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = [] // TODO: branch to real history if disponible
    let rec = getOrCreateDailyRecommendation({
      npcId,
      masteryByTag,
      history,
      nowTs: Date.now(),
    })
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

      {daily && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Défis du jour</h3>
          <div className="grid" style={{ gap: 10 }}>
            {daily.quests.slice(0, 3).map((q: any) => {
              const pct = Math.min(100, Math.round((q.progress / q.target) * 100))
              return (
                <div key={q.id} className="pill" style={{ position:'relative', overflow:'hidden' }}>
                  <div style={{ fontWeight: 700, display:'flex', alignItems:'center', gap:6 }}>
                    {q.completed ? '✅' : '🟡'} {q.title}
                  </div>
                  <div className="small">{q.progress}/{q.target}</div>
                  <div style={{ height: 8, background:'rgba(255,255,255,0.1)', borderRadius: 999, marginTop: 6 }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: q.completed ? 'linear-gradient(90deg,#7fffb2,#2ecc71)' : 'linear-gradient(90deg,#7aa2ff,#7fffb2)',
                      transition:'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {days.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>7 derniers jours</h3>
          <div className="row" style={{ gap: 8, flexWrap:'wrap' }}>
            {days.map((d: any) => {
              const ok = (d.sessions || 0) > 0
              return (
                <div key={d.dateKey} className="pill" style={{ minWidth: 80, textAlign:'center', background: ok ? 'rgba(46,204,113,0.16)' : 'rgba(255,255,255,0.08)', borderColor: ok ? 'rgba(46,204,113,0.5)' : 'rgba(255,255,255,0.18)' }}>
                  <div style={{ fontWeight: 700 }}>{d.dateKey.slice(5)}</div>
                  <div className="small">{ok ? 'Séance ✓' : '—'}</div>
                  <div className="small">XP {d.xp || 0}</div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ background:'linear-gradient(120deg, rgba(122,162,255,0.25), rgba(46,204,113,0.18))' }}>
        <h3 style={{ marginTop: 0 }}>🗺️ Carte du monde (MaloCraft)</h3>
        <div className="small" style={{ marginBottom: 10 }}>Explore les biomes, trouve ton bloc cible et lance une expédition.</div>
        <Link to="/world" className="btn">Ouvrir la carte</Link>
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
        }}
      />
    </div>
  )
}
