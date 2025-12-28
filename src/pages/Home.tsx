import React from 'react'
import { Link } from 'react-router-dom'
import { listInventory } from '../data/rewards'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { BADGES } from '../rewards/badgesCatalog'
import { listLast7Days } from '../stats/dayLog'
import { useNavigate } from 'react-router-dom'
import { getPreferredNpcId, setPreferredNpcId, getOrCreateDailyRecommendation, setDailyRecommendation, setDailyRerollUsed, getDailyRerollUsed, clearDailyRecommendation, getDailyRecommendation, getDailyRerollCount, incrementDailyRerollCount } from '../game/npc/npcStorage'
import { NpcPickerModal } from '../components/game/NpcPickerModal'
import { NpcGuideCard } from '../components/game/NpcGuideCard'
import { buildNpcRecommendation, formatDateKeyParis } from '../game/npc/npcRecommendation'
import type { NpcRecommendation } from '../game/npc/npcRecommendation'
import { BIOMES_SORTED } from '../game/biomeCatalog'
import { getBlocksForBiome } from '../game/blockCatalog'
import { listExercisesByTag } from '../data/firestore'
import { TAG_CATALOG } from '../taxonomy/tagCatalog'
import { getBlockDef } from '../game/blockCatalog'
import { loadNpcPriorityTags } from '../data/npcPriorities'

export function HomePage() {
  const { user, role } = useAuth()
  const { rewards } = useUserRewards(user?.uid || null)
  const nav = useNavigate()
  const [showNpcPicker, setShowNpcPicker] = React.useState(false)
  const [npcId, setNpcId] = React.useState(getPreferredNpcId())
  const [recommendation, setRecommendation] = React.useState<NpcRecommendation | null>(null)
  const [inventory, setInventory] = React.useState<any[]>([])
  const [days, setDays] = React.useState<any[]>([])
  const [availableTags, setAvailableTags] = React.useState<string[]>([])
  const [npcMessage, setNpcMessage] = React.useState<string>('')
  const [loadingTags, setLoadingTags] = React.useState<boolean>(true)
  const [showRerollModal, setShowRerollModal] = React.useState(false)
  const [excludedTag, setExcludedTag] = React.useState<string | null>(null)
  const [lastRerollTs, setLastRerollTs] = React.useState<number>(0)
  const [priorityTags, setPriorityTags] = React.useState<string[]>([])
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
  const rerollCount = getDailyRerollCount(dateKey)
  const rerollLimit = role === 'parent' ? 100 : 1

  const onReroll = () => {
    // Réinitialise la mission du jour avant de tirer
    clearDailyRecommendation(dateKey)
    setLastRerollTs(Date.now())
    const currentCount = getDailyRerollCount(dateKey)
    const limit = rerollLimit
    if (currentCount >= limit || (role !== 'parent' && getDailyRerollUsed(dateKey))) {
      setNpcMessage(role === 'parent' ? 'Limite de changements atteinte pour aujourd’hui.' : 'Tu as déjà changé de mission aujourd’hui.')
      setShowRerollModal(true)
      return
    }
    const masteryByTag = rewards?.masteryByTag || {}
    const previousTag = recommendation?.expedition.targetTagId
    if (previousTag) setExcludedTag(previousTag)
    const usableTags = previousTag ? availableTags.filter(t => t !== previousTag) : (excludedTag ? availableTags.filter(t => t !== excludedTag) : availableTags)
    const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = []
    const filteredMastery = { ...masteryByTag }
    if (previousTag) delete (filteredMastery as any)[previousTag]
    const rec = buildNpcRecommendation({
      npcId,
      masteryByTag: filteredMastery,
      history,
      nowTs: Date.now(),
      excludeTagIds: previousTag ? [previousTag] : (excludedTag ? [excludedTag] : []),
      availableTagIds: usableTags,
      priorityTagsOverride: priorityTags,
    })
    if (rec) {
      const target = rec.expedition.targetTagId
      const inAvailable = usableTags.includes(target)
      if (!inAvailable) {
        setNpcMessage('Mission indisponible pour ce bloc. Essaie encore.')
        return
      }
      setRecommendation(rec)
      setDailyRecommendation(dateKey, rec)
      if (role === 'parent') {
        incrementDailyRerollCount(dateKey)
      } else {
        setDailyRerollUsed(dateKey)
        incrementDailyRerollCount(dateKey)
      }
      setExcludedTag(null)
      setNpcMessage('')
    } else {
      setNpcMessage('Aucune autre mission disponible pour l’instant.')
    }
  }

  const onStartMission = async () => {
    if (!recommendation) return
    const targetTag = recommendation.expedition.targetTagId
    if (availableTags.length && !availableTags.includes(targetTag)) {
      setNpcMessage('Mission indisponible (aucune question pour ce bloc). Change de mission.')
      return
    }
    try {
      const list = await listExercisesByTag(targetTag, { uid: user?.uid })
      if (!list.length) {
        setNpcMessage('Aucune question pour ce bloc. Change de mission.')
        return
      }
    } catch {
      setNpcMessage('Impossible de vérifier les questions pour ce bloc.')
      return
    }
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
        // ignore inventory errors for now
      }
      try {
        const last = await listLast7Days(user.uid)
        setDays(last)
      } catch (e) {
        // ignore streak errors for now
      }
    })()
  }, [user])

  React.useEffect(() => {
    const loadAvailable = async () => {
      setLoadingTags(true)
      const candidates = Object.keys(TAG_CATALOG || {})
      const results = await Promise.all(candidates.map(async (tag) => {
        try {
          const list = await listExercisesByTag(tag, { uid: user?.uid })
          return list.length ? tag : null
        } catch {
          return null
        }
      }))
      const valid = results.filter(Boolean) as string[]
      // Debug: trace la liste des tags disponibles
      // eslint-disable-next-line no-console
      console.info('[home.availableTags]', { count: valid.length, tags: valid })
      setAvailableTags(valid)
      setLoadingTags(false)
      if (!valid.length) {
        setNpcMessage('Pas de mission disponible (aucune question trouvée).')
      } else {
        setNpcMessage('')
      }
    }
    loadAvailable()
    // Charger les priorités PNJ pour l'utilisateur courant (enfant)
    ;(async () => {
      const tags = await loadNpcPriorityTags(user?.uid || null)
      setPriorityTags(tags)
    })()
  }, [rewards, user])

  React.useEffect(() => {
    if (!recommendation && availableTags.length && !loadingTags) {
      const masteryByTag = rewards?.masteryByTag || {}
      const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = []
      const rec = buildNpcRecommendation({ npcId, masteryByTag, history, nowTs: Date.now(), availableTagIds: availableTags })
      if (rec) {
        const dk = formatDateKeyParis(Date.now())
        setDailyRecommendation(dk, rec)
        setRecommendation(rec)
        setNpcMessage('')
      }
    }
  }, [recommendation, availableTags, loadingTags, rewards, npcId])

  React.useEffect(() => {
    if (loadingTags) {
      setRecommendation(null)
      return
    }
    if (availableTags.length === 0) {
      const dateKey = formatDateKeyParis(Date.now())
      clearDailyRecommendation(dateKey)
      setRecommendation(null)
      setNpcMessage('Pas de mission disponible (aucun exercice trouvé).')
      return
    }
    const dateKey = formatDateKeyParis(Date.now())
    const masteryByTag = rewards?.masteryByTag || {}
    const usableTags = excludedTag ? availableTags.filter(t => t !== excludedTag) : availableTags
    const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = [] // TODO: branch to real history si disponible
    const stored = getDailyRecommendation(dateKey)
    let rec = stored && stored.npcId === npcId ? stored : null
    if (rec && usableTags.length && !usableTags.includes(rec.expedition.targetTagId)) {
      rec = null
      clearDailyRecommendation(dateKey)
    }
    if (!rec && usableTags.length) {
      clearDailyRecommendation(dateKey)
      rec = getOrCreateDailyRecommendation({
        npcId,
        masteryByTag,
        history,
        nowTs: Date.now(),
        availableTagIds: usableTags.length ? usableTags : undefined,
        priorityTagsOverride: priorityTags,
      })
    }
    if (!rec && usableTags.length) {
      rec = buildNpcRecommendation({
        npcId,
        masteryByTag,
        history,
        nowTs: Date.now(),
        availableTagIds: usableTags,
        excludeTagIds: excludedTag ? [excludedTag] : [],
        priorityTagsOverride: priorityTags,
      })
      if (rec) setDailyRecommendation(dateKey, rec)
    }
    // Retry sans exclusion si rien trouvé
    if (!rec && excludedTag && availableTags.length) {
      rec = buildNpcRecommendation({ npcId, masteryByTag, history, nowTs: Date.now(), availableTagIds: availableTags })
      if (rec) {
        setExcludedTag(null)
        setDailyRecommendation(dateKey, rec)
      }
    }
    // Debug : trace la recommandation ou son absence
    // eslint-disable-next-line no-console
    console.info('[home.recommendation]', {
      availableTags: usableTags,
      excludedTag,
      rec: rec ? {
        npcId: rec.npcId,
        target: rec.expedition.targetTagId,
        type: rec.expedition.type,
      } : null,
      stored: !!stored,
      lastRerollTs,
    })
    setRecommendation(rec)
    if (!rec && availableTags.length === 0 && !loadingTags) {
      setNpcMessage('Pas de mission disponible (aucun exercice trouvé).')
    } else {
      setNpcMessage('')
    }
  }, [npcId, rewards, availableTags, excludedTag, loadingTags])

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
        {npcMessage && <div className="small" style={{ marginTop:8, color:'#ffb347' }}>{npcMessage}</div>}
      </div>

      {recommendation ? (
        <NpcGuideCard
          recommendation={recommendation}
          dateKey={dateKey}
          onStart={onStartMission}
          onReroll={onReroll}
          onChangeNpc={() => setShowNpcPicker(true)}
          rerollCount={getDailyRerollCount(dateKey)}
          rerollLimit={role === 'parent' ? 100 : 1}
        />
      ) : (
        <div className="card mc-card">
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>Guide Malo</div>
              <div style={{ fontWeight:900 }}>Choisis un guide pour ta prochaine mission</div>
              <div className="small" style={{ color:'var(--mc-muted)', marginTop:4 }}>
                Aucune mission générée pour l’instant. Vérifie qu’il y a des questions publiées pour tes blocs.
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
          const masteryByTag = rewards?.masteryByTag || {}
          const history: Array<{ tagIds: string[], correct: boolean, ts: number }> = []
          const rec = buildNpcRecommendation({ npcId: id, masteryByTag, history, nowTs: Date.now(), availableTagIds: availableTags })
          if (rec) {
            setDailyRecommendation(dateKey, rec)
            setRecommendation(rec)
            setNpcMessage('')
          } else {
            clearDailyRecommendation(dateKey)
            setRecommendation(null)
            setNpcMessage('Pas de mission disponible (aucun exercice trouvé).')
          }
        }}
      />

      {showRerollModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div className="card mc-card" style={{ maxWidth:360 }}>
            <h3 className="mc-title">Mission déjà changée</h3>
            <div className="small" style={{ color:'var(--mc-muted)' }}>Tu ne peux plus changer la mission aujourd’hui.</div>
            <div className="row" style={{ marginTop:12, justifyContent:'flex-end', gap:8 }}>
              <button className="mc-button" onClick={() => setShowRerollModal(false)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
