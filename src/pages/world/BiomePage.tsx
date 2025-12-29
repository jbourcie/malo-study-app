import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBiome } from '../../game/biomeCatalog'
import { getBlocksForBiome, type BiomeId } from '../../game/blockCatalog'
import { useAuth } from '../../state/useAuth'
import { useUserRewards } from '../../state/useUserRewards'
import { useDailyQuests } from '../../state/useDailyQuests'
import { getMasteryState, stateToUiLabel } from '../../game/worldHelpers'
import type { MasteryState } from '../../rewards/rewards'
import { getTagMeta } from '../../taxonomy/tagCatalog'
import { getAvailableExpeditionsForBlock, type Expedition } from '../../game/expeditions'
import { shouldRepair } from '../../pedagogy/questionSelector'
import { listExercisesByTag } from '../../data/firestore'
import { getBlockVisualState, getZoneVisualState, getBiomeVisualState } from '../../game/visualProgress'
import { zoneKey } from '../../game/rebuildService'
import { adviseNpcAction, type LastAdvice } from '../../game/npc/npcGuideAdvisor'
import { NPC_CATALOG } from '../../game/npc/npcCatalog'
import { getPreferredNpcId, setPreferredNpcId } from '../../game/npc/npcStorage'
import { NpcPickerModal } from '../../components/game/NpcPickerModal'
import { loadNpcPriorityTags } from '../../data/npcPriorities'

function getParisDateKeyLocal(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = formatter.formatToParts(now)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

export function BiomePage() {
  const { biomeId } = useParams<{ biomeId: BiomeId }>()
  const biome = biomeId ? getBiome(biomeId) : null
  const { user } = useAuth()
  const { rewards, loading } = useUserRewards(user?.uid || null)
  const { daily } = useDailyQuests(user?.uid || null)
  const navigate = useNavigate()
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [availability, setAvailability] = React.useState<Record<string, boolean>>({})
  const [npcId, setNpcId] = React.useState(getPreferredNpcId())
  const [showNpcPicker, setShowNpcPicker] = React.useState(false)
  const [allowedTags, setAllowedTags] = React.useState<Set<string> | null>(null)
  const initialLastAdvice: LastAdvice | null = (() => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem(`npcGuide:last:${biomeId || ''}`)
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.adviceId && parsed.actionType) return parsed as LastAdvice
      } catch {
        // legacy string storage
        return { adviceId: 'legacy', actionType: 'explore', messageKey: raw }
      }
    } catch {
      return null
    }
  })()
  const lastAdviceRef = React.useRef<LastAdvice | null>(initialLastAdvice)

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
  const blockProgress = rewards.blockProgress || {}
  const zoneRebuildProgress = rewards.zoneRebuildProgress || {}
  const biomeRebuildProgress = rewards.biomeRebuildProgress || {}
  const stateOrder: Record<MasteryState, number> = { mastered: 0, progressing: 1, discovering: 2 }
  const blocks = getBlocksForBiome(biomeId)
    .map((block) => {
      const meta = getTagMeta(block.tagId)
      const masteryState = getMasteryState(masteryByTag, block.tagId)
      const progressEntry = blockProgress[block.tagId]
      const visual = getBlockVisualState({ ...(progressEntry || {}), score: progressEntry?.score ?? masteryByTag?.[block.tagId]?.score ?? 0 })
      return { ...block, masteryState, visual, description: meta.description }
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

  React.useEffect(() => {
    let canceled = false
    const check = async () => {
      const entries = await Promise.all(blocks.map(async (b) => {
        try {
          const list = await listExercisesByTag(b.tagId, { uid: user?.uid })
          return [b.tagId, list.length > 0] as const
        } catch {
          return [b.tagId, false] as const
        }
      }))
      if (!canceled) {
        const next: Record<string, boolean> = {}
        entries.forEach(([tagId, ok]) => { next[tagId] = ok })
        setAvailability(next)
      }
    }
    check()
    return () => { canceled = true }
  }, [blocks, user])

  React.useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = localStorage.getItem(`npcGuide:last:${biomeId || ''}`)
      if (!raw) {
        lastAdviceRef.current = null
        return
      }
      const parsed = JSON.parse(raw)
      if (parsed && parsed.adviceId && parsed.actionType) {
        lastAdviceRef.current = parsed as LastAdvice
      } else {
        lastAdviceRef.current = { adviceId: 'legacy', actionType: 'explore', messageKey: raw }
      }
    } catch {
      lastAdviceRef.current = null
    }
  }, [biomeId])

  React.useEffect(() => {
    let canceled = false
    if (!user?.uid) {
      setAllowedTags(null)
      return
    }
    loadNpcPriorityTags(user.uid)
      .then((tags) => {
        if (canceled) return
        setAllowedTags(new Set(tags))
      })
      .catch(() => {
        if (!canceled) setAllowedTags(null)
      })
    return () => { canceled = true }
  }, [user?.uid])

  React.useEffect(() => {
    setNpcId(getPreferredNpcId())
  }, [biomeId])

  const zones = React.useMemo(() => {
    const byTheme: Record<string, typeof blocks> = {}
    blocks.forEach((block) => {
      if (!byTheme[block.theme]) byTheme[block.theme] = []
      byTheme[block.theme].push(block)
    })
    return Object.entries(byTheme).map(([theme, themeBlocks]) => ({
      theme,
      tagIds: themeBlocks.map((b) => b.tagId),
      visual: getZoneVisualState(
        biome.subject,
        theme,
        themeBlocks.map((b) => b.tagId),
        { blockProgress, masteryByTag },
        zoneRebuildProgress[zoneKey(biome.subject, theme)]
      ),
      blocks: themeBlocks,
    }))
  }, [blocks, blockProgress, masteryByTag, biome.subject, zoneRebuildProgress])

  const biomeVisual = React.useMemo(() => {
    return getBiomeVisualState(
      biome.subject,
      zones.map(z => ({ theme: z.theme, tagIds: z.tagIds })),
      { blockProgress, masteryByTag },
      {
        zoneRebuildProgress,
        biomeRebuild: biomeRebuildProgress[biome.subject],
      }
    )
  }, [biome.subject, zones, blockProgress, masteryByTag, zoneRebuildProgress, biomeRebuildProgress])

  const dailyDateKey = daily?.dateKey || getParisDateKeyLocal()

  const npcAdvice = React.useMemo(() => {
    if (!biomeId) return null
    const seed = `${user?.uid || 'anon'}|${biomeId}|${dailyDateKey}`
    return adviseNpcAction({
      biomeId,
      subjectId: biome.subject,
      zones,
      biomeVisual,
      masteryByTag,
      blockProgress,
      allowedTags: allowedTags || undefined,
      seed,
      lastAdvice: lastAdviceRef.current,
    })
  }, [allowedTags, biome.subject, biomeId, biomeVisual, blockProgress, dailyDateKey, masteryByTag, user?.uid, zones])

  React.useEffect(() => {
    if (!npcAdvice || !biomeId) return
    if (lastAdviceRef.current?.adviceId === npcAdvice.adviceId && lastAdviceRef.current?.messageKey === npcAdvice.messageKey) return
    lastAdviceRef.current = {
      adviceId: npcAdvice.adviceId,
      actionType: npcAdvice.actionType,
      messageKey: npcAdvice.messageKey,
    }
    try {
      localStorage.setItem(`npcGuide:last:${biomeId}`, JSON.stringify(lastAdviceRef.current))
    } catch {
      // storage best effort only
    }
  }, [biomeId, npcAdvice])

  const zoneLabel: Record<string, string> = {
    ruins: 'Ruines',
    building: 'En chantier',
    rebuilt_ready: 'Prête à reconstruire',
    rebuilding: 'Reconstruction en cours',
    rebuilt: 'Reconstruite',
  }

  const zoneTone: Record<string, string> = {
    ruins: '',
    building: 'accent',
    rebuilt_ready: 'gold',
    rebuilding: 'accent',
    rebuilt: 'gold',
  }

  const biomeRebuildLabel: Record<string, string> = {
    not_ready: 'Pré-requis manquants',
    ready: 'Biome prêt',
    rebuilding: 'Reconstruction en cours',
    rebuilt: 'Biome reconstruit',
  }

  const canRebuildBiome = biomeVisual.rebuild?.status === 'ready' || biomeVisual.rebuild?.status === 'rebuilding'
  const npc = NPC_CATALOG[npcId]

  const handleNpcAction = React.useCallback(() => {
    if (!npcAdvice) return
    if (npcAdvice.actionType === 'reconstruction_theme' && npcAdvice.payload?.theme) {
      navigate(`/theme/reconstruction_${encodeURIComponent(npcAdvice.payload.theme)}?sessionKind=reconstruction_theme&subjectId=${biome.subject}&theme=${encodeURIComponent(npcAdvice.payload.theme)}`)
      return
    }
    if (npcAdvice.actionType === 'reconstruction_biome') {
      navigate(`/theme/reconstruction_biome_${biome.subject}?sessionKind=reconstruction_biome&subjectId=${biome.subject}`)
      return
    }
    if (npcAdvice.actionType === 'tag_session') {
      const tagId = npcAdvice.payload?.tagId
      if (tagId) {
        const params = new URLSearchParams()
        params.set('expeditionType', npcAdvice.payload?.expeditionType || 'mine')
        params.set('targetTagId', tagId)
        params.set('biomeId', biomeId)
        navigate(`/theme/expedition?${params.toString()}`)
        return
      }
    }
    navigate(`/world/${biomeId}`)
  }, [biome.subject, biomeId, navigate, npcAdvice])

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

      {npcAdvice && (
        <div className="card mc-card">
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:'2rem' }}>{npc.avatar}</div>
              <div>
                <div style={{ fontWeight:900 }}>{npc.name}</div>
                <div className="small" style={{ color:'var(--mc-muted)' }}>{npc.shortTagline}</div>
              </div>
            </div>
            <button className="mc-button secondary" onClick={() => setShowNpcPicker(true)}>Changer de guide</button>
          </div>
          <div className="mc-card" style={{ marginTop:10, border:'2px solid var(--mc-border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
              <div style={{ flex:1 }}>
                <div className="small" style={{ color:'var(--mc-muted)' }}>Guide MaloCraft</div>
                <div style={{ fontWeight: 800 }}>{npcAdvice.message}</div>
              </div>
              <button className="mc-button" onClick={handleNpcAction}>
                {npcAdvice.ctaLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card mc-card">
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>Biome</div>
            <div style={{ fontWeight: 800 }}>Reconstruction du biome</div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>
              Zones reconstruites : {biomeVisual.rebuild?.rebuiltZones || 0}/{biomeVisual.rebuild?.totalZones || 0} (seuil 60%)
            </div>
          </div>
          <div className="row" style={{ gap: 8, alignItems:'center' }}>
            <span className="mc-chip">
              {biomeRebuildLabel[biomeVisual.rebuild?.status || 'not_ready']}
            </span>
            <button
              className="mc-button"
              disabled={!canRebuildBiome}
              title={canRebuildBiome ? 'Lancer la reconstruction du biome' : 'Reconstruis d’abord 60% des zones'}
              onClick={() => {
                if (!canRebuildBiome) return
                navigate(`/theme/reconstruction_biome_${biome.subject}?sessionKind=reconstruction_biome&subjectId=${biome.subject}`)
              }}
            >
              Reconstruire le biome
            </button>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="small">Jauge : {biomeVisual.rebuild?.correctCount || 0}/{biomeVisual.rebuild?.target || 100}</div>
          <div style={{ background:'rgba(255,255,255,0.08)', border:'1px solid var(--mc-border)', borderRadius:6, height:12, overflow:'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.round(((biomeVisual.rebuild?.correctCount || 0) / (biomeVisual.rebuild?.target || 100)) * 100))}%`, background:'var(--mc-accent)', height:'100%' }} />
          </div>
        </div>
      </div>

      <div className="card mc-card">
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="small" style={{ color:'var(--mc-muted)' }}>Zones du biome</div>
            <div style={{ fontWeight: 800 }}>État des zones ({zones.length})</div>
          </div>
        </div>
        {loading ? (
          <div className="grid2" style={{ marginTop: 10 }}>
            {[1,2,3].map(i => <div key={i} className="mc-card skeleton" style={{ height:82 }} />)}
          </div>
        ) : (
          <div className="grid2" style={{ marginTop: 10 }}>
            {zones.map((zone) => (
              <div
                key={zone.theme}
                className="mc-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/world/${biomeId}/zone/${encodeURIComponent(zone.theme)}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/world/${biomeId}/zone/${encodeURIComponent(zone.theme)}`)
                  }
                }}
              >
                <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{zone.theme}</div>
                    <div className="small" style={{ color:'var(--mc-muted)' }}>
                      {zone.blocks.length} blocs · stables {zone.visual.breakdown.stablePct}%
                    </div>
                  </div>
                  <span className={`mc-chip ${zoneTone[zone.visual.state] || ''}`}>
                    {zoneLabel[zone.visual.state] || zone.visual.state}
                  </span>
                </div>
                {zone.visual.rebuild && (
                  <div style={{ marginTop: 6 }}>
                    <div className="small" style={{ color:'var(--mc-muted)' }}>
                      Reconstruction : {zone.visual.rebuild.correctCount}/{zone.visual.rebuild.target}
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.08)', border:'1px solid var(--mc-border)', borderRadius:6, height:8, overflow:'hidden' }}>
                      <div style={{ width: `${Math.min(100, Math.round((zone.visual.rebuild.correctCount / zone.visual.rebuild.target) * 100))}%`, background:'var(--mc-accent)', height:'100%' }} />
                    </div>
                  </div>
                )}
                {zone.visual.weatheredPct > 0 && (
                  <div className="small" style={{ marginTop: 6, color:'var(--mc-muted)' }}>
                    {zone.visual.weatheredPct}% des blocs patinés (14j+ sans activité)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
          const hasQuestions = availability[block.tagId] !== false
          return (
          <div
            key={block.tagId}
            className={`block-card mc-card ${stateClass}`}
            role="button"
            tabIndex={0}
            onClick={() => hasQuestions && setSelectedBlockId(block.tagId)}
            onKeyDown={(e) => { if (hasQuestions && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedBlockId(block.tagId) } }}
            style={{
              cursor: hasQuestions ? 'pointer' : 'not-allowed',
              opacity: hasQuestions ? 1 : 0.55,
              outline: selectedBlockId === block.tagId ? '2px solid var(--mc-accent)' : undefined,
            }}
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
              {!hasQuestions && (
                <div className="small" style={{ color:'var(--mc-muted)', marginTop:6 }}>
                  Pas encore de missions pour ce bloc.
                </div>
              )}
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
                      onClick={() => navigate(`/theme/expedition?expeditionType=${exp.type}&targetTagId=${selected.tagId}&biomeId=${biomeId}`)}
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
