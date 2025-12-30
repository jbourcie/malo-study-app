import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BIOMES_SORTED, getBiome } from '../game/biomeCatalog'
import { getBlocksForBiome } from '../game/blockCatalog'
import { getZoneVisualState, getBiomeVisualState, getBlockVisualState } from '../game/visualProgress'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { useDailyQuests } from '../state/useDailyQuests'
import { getTagMeta } from '../taxonomy/tagCatalog'
import { Drawer } from '../components/ui/Drawer'
import { BiomeTile } from '../components/world/WorldTiles'
import { BiomeSummaryPanel, ZoneTilesGrid, BlockGrid, BlockActionsPanel } from '../components/world/BiomePanels'
import { ZoneSummaryPanel, ZoneBlocksGrid } from '../components/world/ZonePanels'
import { PlayerHudCompact } from '../components/home/PlayerHudCompact'
import { DailyQuestsCompact } from '../components/home/DailyQuestsCompact'
import { getAvailableExpeditionsForBlock } from '../game/expeditions'
import { shouldRepair } from '../pedagogy/questionSelector'
import { listLast7Days } from '../stats/dayLog'
import type { DailyQuest } from '../rewards/daily'
import { getNpcLine } from '../game/npc/npcDialogue'
import { getPreferredNpcId, setPreferredNpcId } from '../game/npc/npcStorage'
import { NpcPickerModal } from '../components/game/NpcPickerModal'
import { adviseNpcAction, type LastAdvice } from '../game/npc/npcGuideAdvisor'
import { zoneKey } from '../game/rebuildService'
import { NPC_CATALOG } from '../game/npc/npcCatalog'
import { CollectionContent } from './Collection'
import { ChestContent } from './ChestPage'
import { stateToUiLabel, getMasteryState } from '../game/worldHelpers'
import { getBlocksForBiome as getBlocks } from '../game/blockCatalog'

function getParisDateKeyLocal(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = formatter.formatToParts(now)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

export function WorldHubPage() {
  const { user, role, activeChild, recoveryCode } = useAuth()
  const isObserver = role === 'parent' || role === 'admin'
  const playerUid = activeChild?.id || user?.uid || null
  const { rewards } = useUserRewards(playerUid)
  const { daily, loading: loadingDaily } = useDailyQuests(playerUid)
  const nav = useNavigate()
  const [npcId, setNpcId] = React.useState(getPreferredNpcId())
  const [showNpcPicker, setShowNpcPicker] = React.useState(false)
  const [streak, setStreak] = React.useState<number>(0)

  const [openBiomeId, setOpenBiomeId] = React.useState<string | null>(null)
  const [openZone, setOpenZone] = React.useState<{ biomeId: string, theme: string } | null>(null)
  const [openBlock, setOpenBlock] = React.useState<{ tagId: string, biomeId: string } | null>(null)
  const [openChest, setOpenChest] = React.useState(false)
  const [openCollection, setOpenCollection] = React.useState(false)
  const [highlightBiomeId, setHighlightBiomeId] = React.useState<string | null>(null)
  const [highlightZoneTheme, setHighlightZoneTheme] = React.useState<string | null>(null)

  const blockProgress = rewards.blockProgress || {}
  const masteryByTag = rewards.masteryByTag || {}
  const zoneRebuildProgress = rewards.zoneRebuildProgress || {}
  const biomeRebuildProgress = rewards.biomeRebuildProgress || {}
  const equippedAvatarId = rewards.collectibles?.equippedAvatarId || null

  React.useEffect(() => {
    if (!playerUid) return
    ;(async () => {
      try {
        const last = await listLast7Days(playerUid)
        const sorted = [...last].sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''))
        let s = 0
        for (const d of sorted) {
          if ((d.sessions || 0) > 0) s += 1
          else break
        }
        setStreak(s)
      } catch {
        setStreak(0)
      }
    })()
  }, [playerUid])

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
    if (isObserver) return
    const targetQuest = quest || questsWithLines.find(q => q.tagId) || null
    const targetTag = targetQuest?.tagId
    if (targetTag) {
      const params = new URLSearchParams()
      params.set('expeditionType', targetQuest?.type === 'remediation' ? 'repair' : 'mine')
      params.set('targetTagId', targetTag)
      nav(`/theme/expedition?${params.toString()}`)
    } else {
      nav('/world')
    }
  }

  const dailyDateKey = daily?.dateKey || getParisDateKeyLocal()

  const biomeTiles = React.useMemo(() => {
    return BIOMES_SORTED.map((biome) => {
      const blocks = getBlocksForBiome(biome.id)
      const masteredCount = blocks.filter(
        (block) => rewards.masteryByTag?.[block.tagId]?.state === 'mastered'
      ).length
      const total = blocks.length
      const zonesMap: Record<string, string[]> = {}
      blocks.forEach(b => {
        if (!zonesMap[b.theme]) zonesMap[b.theme] = []
        zonesMap[b.theme].push(b.tagId)
      })
      const zones = Object.entries(zonesMap).map(([theme, tagIds]) => ({ theme, tagIds }))
      const biomeVisual = getBiomeVisualState(
        biome.subject,
        zones,
        { blockProgress, masteryByTag },
        { zoneRebuildProgress, biomeRebuild: biomeRebuildProgress[biome.subject] }
      )
      return { biome, masteredCount, total, biomeVisual }
    })
  }, [blockProgress, masteryByTag, zoneRebuildProgress, biomeRebuildProgress, rewards.masteryByTag])

  const focusBiomeId = openBiomeId || BIOMES_SORTED[0]?.id || null
  const focusBiome = focusBiomeId ? getBiome(focusBiomeId) : null

  const zonesForFocusBiome = React.useMemo(() => {
    if (!focusBiomeId) return []
    const blocks = getBlocksForBiome(focusBiomeId)
    const byTheme: Record<string, typeof blocks> = {}
    blocks.forEach((block) => {
      if (!byTheme[block.theme]) byTheme[block.theme] = []
      byTheme[block.theme].push(block)
    })
    return Object.entries(byTheme).map(([theme, themeBlocks]) => ({
      theme,
      tagIds: themeBlocks.map((b) => b.tagId),
      blocks: themeBlocks,
      visual: getZoneVisualState(
        focusBiome?.subject || themeBlocks[0]?.subject || 'fr',
        theme,
        themeBlocks.map((b) => b.tagId),
        { blockProgress, masteryByTag },
        zoneRebuildProgress[zoneKey(focusBiome?.subject || themeBlocks[0]?.subject || 'fr', theme)]
      ),
    }))
  }, [blockProgress, masteryByTag, focusBiome?.subject, focusBiomeId, zoneRebuildProgress])

  const focusBiomeVisual = React.useMemo(() => {
    if (!focusBiome) return null
    return getBiomeVisualState(
      focusBiome.subject,
      zonesForFocusBiome.map(z => ({ theme: z.theme, tagIds: z.tagIds })),
      { blockProgress, masteryByTag },
      { zoneRebuildProgress, biomeRebuild: biomeRebuildProgress[focusBiome.subject] }
    )
  }, [blockProgress, masteryByTag, zoneRebuildProgress, biomeRebuildProgress, focusBiome, zonesForFocusBiome])

  const lastAdviceRef = React.useRef<LastAdvice | null>(null)
  React.useEffect(() => {
    try {
      if (!focusBiomeId) return
      const raw = localStorage.getItem(`npcGuide:last:${focusBiomeId}`) || ''
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
  }, [focusBiomeId])

  const npcAdvice = React.useMemo(() => {
    if (!focusBiome || !focusBiomeVisual) return null
    const seed = `${playerUid || 'anon'}|${focusBiome.id}|${dailyDateKey}`
    return adviseNpcAction({
      biomeId: focusBiome.id,
      subjectId: focusBiome.subject,
      zones: zonesForFocusBiome,
      biomeVisual: focusBiomeVisual,
      masteryByTag,
      blockProgress,
      allowedTags: undefined,
      seed,
      lastAdvice: lastAdviceRef.current,
    })
  }, [blockProgress, dailyDateKey, focusBiome, focusBiomeVisual, masteryByTag, playerUid, zonesForFocusBiome])

  if (!playerUid) {
    return (
      <div className="container">
        <div className="card">Sélectionnez un enfant rattaché pour accéder au monde.</div>
      </div>
    )
  }

  React.useEffect(() => {
    if (!npcAdvice || !focusBiome) {
      setHighlightBiomeId(null)
      setHighlightZoneTheme(null)
      return
    }
    if (npcAdvice.actionType === 'reconstruction_biome') {
      setHighlightBiomeId(focusBiome.id)
      setHighlightZoneTheme(null)
    } else if (npcAdvice.actionType === 'reconstruction_theme' && npcAdvice.payload?.theme) {
      setHighlightBiomeId(focusBiome.id)
      setHighlightZoneTheme(npcAdvice.payload.theme)
    } else if (npcAdvice.actionType === 'tag_session' && npcAdvice.payload?.tagId) {
      const blocks = getBlocks(focusBiome.id)
      const block = blocks.find(b => b.tagId === npcAdvice.payload?.tagId)
      setHighlightBiomeId(focusBiome.id)
      setHighlightZoneTheme(block?.theme || null)
    }
  }, [focusBiome, npcAdvice])

  React.useEffect(() => {
    if (!npcAdvice || !focusBiomeId) return
    if (lastAdviceRef.current?.adviceId === npcAdvice.adviceId && lastAdviceRef.current?.messageKey === npcAdvice.messageKey) return
    lastAdviceRef.current = {
      adviceId: npcAdvice.adviceId,
      actionType: npcAdvice.actionType,
      messageKey: npcAdvice.messageKey,
    }
    try {
      localStorage.setItem(`npcGuide:last:${focusBiomeId}`, JSON.stringify(lastAdviceRef.current))
    } catch {
      // ignore
    }
  }, [focusBiomeId, npcAdvice])

  const selectedBiome = openBiomeId ? getBiome(openBiomeId) : null
  const biomeBlocks = React.useMemo(() => {
    if (!openBiomeId) return []
    return getBlocksForBiome(openBiomeId)
      .map((block) => {
        const meta = getTagMeta(block.tagId)
        const progressEntry = blockProgress[block.tagId]
        const masteryState = getMasteryState(masteryByTag, block.tagId)
        const visual = getBlockVisualState({ ...(progressEntry || {}), score: progressEntry?.score ?? masteryByTag?.[block.tagId]?.score ?? 0 })
        return { ...block, blockName: block.blockName, description: meta.description, visual, masteryState }
      })
  }, [blockProgress, masteryByTag, openBiomeId])

  const biomeZones = React.useMemo(() => {
    if (!openBiomeId || !selectedBiome) return []
    const byTheme: Record<string, typeof biomeBlocks> = {}
    biomeBlocks.forEach((block) => {
      if (!byTheme[block.theme]) byTheme[block.theme] = []
      byTheme[block.theme].push(block)
    })
    return Object.entries(byTheme).map(([theme, themeBlocks]) => ({
      theme,
      tagIds: themeBlocks.map((b) => b.tagId),
      visual: getZoneVisualState(
        selectedBiome.subject,
        theme,
        themeBlocks.map((b) => b.tagId),
        { blockProgress, masteryByTag },
        zoneRebuildProgress[zoneKey(selectedBiome.subject, theme)]
      ),
      blocks: themeBlocks,
    }))
  }, [biomeBlocks, blockProgress, masteryByTag, openBiomeId, selectedBiome, zoneRebuildProgress])

  const selectedZoneData = React.useMemo(() => {
    if (!openZone || !selectedBiome) return null
    return biomeZones.find(z => z.theme === openZone.theme) || null
  }, [biomeZones, openZone, selectedBiome])

  const selectedBlockData = React.useMemo(() => {
    if (!openBlock) return null
    const block = biomeBlocks.find(b => b.tagId === openBlock.tagId)
    return block || null
  }, [biomeBlocks, openBlock])

  const blockExpeditions = React.useMemo(() => {
    if (!selectedBlockData || !selectedBiome) return []
    return getAvailableExpeditionsForBlock({
      tagId: selectedBlockData.tagId,
      biomeId: selectedBiome.id as any,
      masteryState: getMasteryState(masteryByTag, selectedBlockData.tagId),
      shouldRepair: shouldRepair(selectedBlockData.tagId, []),
    })
  }, [masteryByTag, selectedBiome, selectedBlockData])

  const onStartExpedition = (expeditionType: string) => {
    if (!selectedBlockData) return
    const params = new URLSearchParams()
    params.set('expeditionType', expeditionType)
    params.set('targetTagId', selectedBlockData.tagId)
    if (selectedBiome) params.set('biomeId', selectedBiome.id)
    nav(`/theme/expedition?${params.toString()}`)
  }

  const npcGuide = NPC_CATALOG[npcId]
  const npcLine = npcAdvice ? getNpcLine(npcId, npcAdvice.messageKey as any, {}) : null

  return (
    <div className="container grid">
      <div className="grid2">
        <PlayerHudCompact
          rewards={rewards}
          streak={streak}
          equippedAvatarId={equippedAvatarId}
          onOpenCollection={() => setOpenCollection(true)}
          onChangeNpc={() => setShowNpcPicker(true)}
        />
        {!isObserver && (
          <div className="card mc-card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '2rem' }}>{npcGuide.avatar}</div>
                <div>
                  <div style={{ fontWeight: 900 }}>{npcGuide.name}</div>
                  <div className="small" style={{ color: 'var(--mc-muted)' }}>{npcGuide.shortTagline}</div>
                </div>
              </div>
              <button className="mc-button secondary" onClick={() => setShowNpcPicker(true)}>Changer</button>
            </div>
            <div className="mc-card" style={{ marginTop: 10, border: '2px solid var(--mc-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div className="small" style={{ color: 'var(--mc-muted)' }}>Guide MaloCraft</div>
                    <div style={{ fontWeight: 800 }}>{npcAdvice?.message || npcLine?.text || 'Choisis un biome pour commencer.'}</div>
                  </div>
                {npcAdvice?.ctaLabel && (
                  <button className="mc-button" onClick={() => {
                    if (npcAdvice.actionType === 'reconstruction_theme' && npcAdvice.payload?.theme && focusBiome) {
                      setOpenBiomeId(focusBiome.id)
                      setOpenZone({ biomeId: focusBiome.id, theme: npcAdvice.payload.theme })
                      setHighlightBiomeId(focusBiome.id)
                      setHighlightZoneTheme(npcAdvice.payload.theme)
                    } else if (npcAdvice.actionType === 'reconstruction_biome' && focusBiome) {
                      setOpenBiomeId(focusBiome.id)
                      setHighlightBiomeId(focusBiome.id)
                      setHighlightZoneTheme(null)
                    } else if (npcAdvice.actionType === 'tag_session' && npcAdvice.payload?.tagId && focusBiome) {
                      const blocks = getBlocks(focusBiome.id)
                      const block = blocks.find(b => b.tagId === npcAdvice.payload?.tagId)
                      const theme = block?.theme
                      setOpenBiomeId(focusBiome.id)
                      if (theme) {
                        setOpenZone({ biomeId: focusBiome.id, theme })
                        setHighlightZoneTheme(theme)
                        setOpenBlock({ tagId: block!.tagId, biomeId: focusBiome.id })
                      } else {
                        setHighlightZoneTheme(null)
                      }
                      setHighlightBiomeId(focusBiome.id)
                    }
                  }}>
                    {npcAdvice.ctaLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {isObserver && activeChild && (
          <div className="card mc-card">
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Profil enfant</div>
            <div className="small">Nom : <strong>{activeChild.displayName}</strong></div>
            {recoveryCode && <div className="small">Code de reprise : <span className="badge">{recoveryCode}</span></div>}
            <div className="small" style={{ color: 'var(--mc-muted)', marginTop: 6 }}>Mode parent : visualisation uniquement (pas de PNJ guide).</div>
          </div>
        )}
      </div>

      {!isObserver && (
        <DailyQuestsCompact
          npcId={npcId}
          quests={questsWithLines}
          loading={loadingDaily}
          bonusAwarded={daily?.bonusAwarded}
          onStart={onStartMission}
          onChangeNpc={() => setShowNpcPicker(true)}
        />
      )}

      {!isObserver && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="mc-button secondary" onClick={() => setOpenChest(true)}>🎒 Inventaire</button>
          <button className="mc-button secondary" onClick={() => setOpenCollection(true)}>🏅 Collection</button>
        </div>
      )}

      <div className="grid2">
        {biomeTiles.map(({ biome, masteredCount, total, biomeVisual }) => (
          <BiomeTile
            key={biome.id}
            biome={biome}
            totalBlocks={total}
            masteredCount={masteredCount}
            monumentCount={biomeVisual.rebuild?.correctCount || 0}
            target={biomeVisual.rebuild?.target || 100}
            highlighted={highlightBiomeId === biome.id}
            onClick={() => { setOpenBiomeId(biome.id); setOpenZone(null); setOpenBlock(null); setHighlightBiomeId(null); setHighlightZoneTheme(null) }}
          />
        ))}
      </div>

      {!isObserver && (
        <NpcPickerModal
          open={showNpcPicker}
          onClose={() => setShowNpcPicker(false)}
          onPicked={(id) => {
            setNpcId(id)
            setPreferredNpcId(id)
            setShowNpcPicker(false)
          }}
        />
      )}

      <Drawer
        open={!!openBiomeId}
        onClose={() => { setOpenBiomeId(null); setOpenZone(null); setOpenBlock(null) }}
        title={selectedBiome ? `${selectedBiome.icon} ${selectedBiome.name}` : 'Biome'}
        zIndex={920}
      >
        {selectedBiome && focusBiomeVisual && (
          <BiomeSummaryPanel
            biome={selectedBiome}
            rebuild={{
              correctCount: focusBiomeVisual.rebuild?.correctCount || 0,
              target: focusBiomeVisual.rebuild?.target || 100,
              statusLabel: focusBiomeVisual.rebuild?.status === 'rebuilt' ? 'Biome reconstruit' : focusBiomeVisual.rebuild?.status === 'ready' ? 'Prêt' : focusBiomeVisual.rebuild?.status === 'rebuilding' ? 'Reconstruction en cours' : 'Pré-requis manquants',
            }}
            canRebuild={focusBiomeVisual.rebuild?.status === 'ready' || focusBiomeVisual.rebuild?.status === 'rebuilding'}
            onRebuild={focusBiomeVisual.rebuild?.status === 'ready' || focusBiomeVisual.rebuild?.status === 'rebuilding'
              ? () => nav(`/theme/reconstruction_biome_${selectedBiome.subject}?sessionKind=reconstruction_biome&subjectId=${selectedBiome.subject}`)
              : undefined}
          />
        )}
        <ZoneTilesGrid
          zones={biomeZones}
          highlightedTheme={highlightZoneTheme}
          onSelect={(theme) => { setOpenZone({ biomeId: openBiomeId!, theme }); setOpenBlock(null); setHighlightZoneTheme(null) }}
        />
      </Drawer>

      <Drawer
        open={!!openZone}
        onClose={() => { setOpenZone(null); setOpenBlock(null) }}
        onBack={() => setOpenZone(null)}
        title={openZone ? `${selectedBiome?.icon || ''} ${openZone.theme}` : 'Zone'}
        zIndex={940}
      >
        {selectedZoneData && selectedBiome && (
          <>
            <ZoneSummaryPanel
              biome={selectedBiome}
              theme={selectedZoneData.theme}
              rebuild={{ correctCount: selectedZoneData.visual.rebuild?.correctCount || 0, target: selectedZoneData.visual.rebuild?.target || 35 }}
              weatheredPct={selectedZoneData.visual.weatheredPct}
              stablePct={selectedZoneData.visual.breakdown.stablePct}
              canRebuild={!isObserver && (selectedZoneData.visual.state === 'rebuilt_ready' || selectedZoneData.visual.state === 'rebuilding')}
              onRebuild={() => {
                if (isObserver) return
                if (selectedZoneData.visual.state !== 'rebuilt_ready' && selectedZoneData.visual.state !== 'rebuilding') return
                nav(`/theme/reconstruction_${encodeURIComponent(selectedZoneData.theme)}?sessionKind=reconstruction_theme&subjectId=${selectedBiome.subject}&theme=${encodeURIComponent(selectedZoneData.theme)}`)
              }}
            />
            <div style={{ marginTop: 10 }}>
              <ZoneBlocksGrid blocks={selectedZoneData.blocks.map(b => ({
                tagId: b.tagId,
                label: getTagMeta(b.tagId).label,
                description: b.description,
                visual: b.visual,
              }))} onSelect={(tagId) => setOpenBlock({ tagId, biomeId: selectedBiome.id })} />
            </div>
          </>
        )}
      </Drawer>

      <Drawer
        open={!!openBlock}
        onClose={() => setOpenBlock(null)}
        onBack={() => setOpenBlock(null)}
        title={selectedBlockData?.blockName || 'Bloc'}
        zIndex={960}
        width={520}
      >
        {selectedBlockData && (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>{selectedBlockData.blockName}</div>
              <div className="small">Etat : {stateToUiLabel(masteryByTag[selectedBlockData.tagId]?.state || 'discovering')}</div>
            </div>
            {!isObserver ? (
              <BlockActionsPanel
                blockName={selectedBlockData.blockName}
                masteryLabel={stateToUiLabel(masteryByTag[selectedBlockData.tagId]?.state || 'discovering')}
                expeditions={blockExpeditions}
                onStart={onStartExpedition}
                onClose={() => setOpenBlock(null)}
              />
            ) : (
              <div className="card" style={{ background:'rgba(255,255,255,0.04)' }}>
                <div className="small">Mode parent : visualisation uniquement.</div>
              </div>
            )}
          </>
        )}
      </Drawer>

      <Drawer open={openChest} onClose={() => setOpenChest(false)} title="Coffre" zIndex={980}>
        <ChestContent />
      </Drawer>

      <Drawer open={openCollection} onClose={() => setOpenCollection(false)} title="Collection" zIndex={980}>
        <CollectionContent />
      </Drawer>

    </div>
  )
}
