import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BIOMES_SORTED, getBiome, subjectToBiomeId } from '../game/biomeCatalog'
import { getBlocksForBiome } from '../game/blockCatalog'
import { getZoneVisualState, getBiomeVisualState, getBlockVisualState } from '../game/visualProgress'
import { useAuth } from '../state/useAuth'
import { useUserRewards } from '../state/useUserRewards'
import { useDailyQuests } from '../state/useDailyQuests'
import { getTagMeta } from '../taxonomy/tagCatalog'
import { Drawer } from '../components/ui/Drawer'
import { BiomeTile } from '../components/world/WorldTiles'
import { BiomeSummaryPanel, ZoneTilesGrid, BlockActionsPanel } from '../components/world/BiomePanels'
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
import { COSMETICS_CATALOG, type Cosmetic } from '../game/cosmeticsCatalog'
import { equipCosmetic, isCosmeticOwned, purchaseCosmetic } from '../rewards/cosmeticsService'
import { listExercisesByTag } from '../data/firestore'
import { loadGraphicPack } from '../world/graphicPacks/loadGraphicPack'
import { getDefaultGraphicPackManifestUrl } from '../world/graphicPacks/registry'
import { injectCssUrls } from '../world/graphicPacks/injectCss'
import type { LoadedGraphicPack } from '../world/graphicPacks/types'
import { MapBaseLayer } from '../world/map/MapBaseLayer'
import { MapOverlayLayout } from '../world/map/MapOverlayLayout'
import { getWorldMapConfig } from '../world/mapConfig/registry'
import type { WorldMapConfig } from '../world/mapConfig/types'
import { resolveBiomeAnchor } from '../world/map/resolveBiomeAnchor'
import { MapAnchorsDebugLayer } from '../world/map/MapAnchorsDebugLayer'
import { resolveZoneAnchors } from '../world/map/resolveZoneAnchors'
import { ZoneMonumentChip } from '../world/map/ZoneMonumentChip'
import { computeZoneProgress } from '../world/map/zoneProgress'
import { resolveBiomeMap } from '../world/map/resolveMap'
import { isBiomeRouteFromWindow } from '../world/map/isBiomeRoute'
import { setNavAnchor } from '../world/transitions/navAnchors'
import { useNavLock } from '../world/transitions/useNavLock'
import { BiomePOI } from '../world/v3/BiomePOI'
import { computeBiomeVisualState } from '../world/v3/progressionStates'

function getParisDateKeyLocal(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = formatter.formatToParts(now)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

function toMillis(value: any): number | null {
  if (!value) return null
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis()
    if (typeof value.toDate === 'function') return value.toDate().getTime()
    if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds ? value.nanoseconds / 1e6 : 0)
  }
  return null
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
  const [openAtelier, setOpenAtelier] = React.useState(false)
  const [cosmeticFilter, setCosmeticFilter] = React.useState<'all' | 'monuments' | 'effects' | 'npc'>('all')
  const [atelierMessage, setAtelierMessage] = React.useState<string | null>(null)
  const [atelierError, setAtelierError] = React.useState<string | null>(null)
  const [atelierBusyId, setAtelierBusyId] = React.useState<string | null>(null)
  const [highlightBiomeId, setHighlightBiomeId] = React.useState<string | null>(null)
  const [highlightZoneTheme, setHighlightZoneTheme] = React.useState<string | null>(null)
  const [showZonesOnMap, setShowZonesOnMap] = React.useState<boolean>(true)

  const blockProgress = rewards.blockProgress || {}
  const masteryByTag = rewards.masteryByTag || {}
  const zoneRebuildProgress = rewards.zoneRebuildProgress || {}
  const biomeRebuildProgress = rewards.biomeRebuildProgress || {}
  const equippedAvatarId = rewards.collectibles?.equippedAvatarId || null
  const [availableTags, setAvailableTags] = React.useState<Set<string> | null>(null)
  const [pack, setPack] = React.useState<LoadedGraphicPack | null>(null)
  const [packError, setPackError] = React.useState<string | null>(null)
  const [isLoadingPack, setIsLoadingPack] = React.useState<boolean>(false)
  const [mapConfig, setMapConfig] = React.useState<WorldMapConfig | null>(null)
  const [debugAnchors, setDebugAnchors] = React.useState<Record<string, { x: number, y: number, radius?: number }>>({})
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const location = useLocation()
  const mapDebug = React.useMemo(() => {
    const envRaw = ((import.meta as any)?.env?.VITE_MAP_DEBUG || '').toString().toLowerCase()
    const envFlag = envRaw === 'true' || envRaw === '1'
    const params = new URLSearchParams(location.search)
    const qp = params.get('mapDebug')?.toLowerCase()
    const qpFlag = qp === '1' || qp === 'true'
    return envFlag || qpFlag
  }, [location.search])
  const { locked: navLocked, lock: lockNav } = useNavLock(450)
  const nowRef = React.useRef(new Date())

  const worldMapSize = React.useMemo(() => {
    if (!pack) return null
    const worldMap = pack.manifest.maps?.world
    return {
      width: worldMap?.width || pack.manifest.map.width,
      height: worldMap?.height || pack.manifest.map.height,
    }
  }, [pack])

  const navigateFromWorld = React.useCallback((path: string, anchor?: { x: number; y: number }, mapSize?: { width?: number; height?: number }) => {
    if (navLocked) return
    lockNav()
    const size = mapSize && mapSize.width && mapSize.height ? { w: mapSize.width, h: mapSize.height } : worldMapSize ? { w: worldMapSize.width, h: worldMapSize.height } : null
    setNavAnchor('world', anchor ? { x: anchor.x, y: anchor.y } : undefined, size || undefined)
    nav(path)
  }, [lockNav, nav, navLocked, worldMapSize])

  React.useEffect(() => {
    if (!mapDebug || !overlayRef.current) return
    const handler = (ev: PointerEvent) => {
      console.info('[WorldHub mapDebug] pointerdown on overlay', { target: ev.target, x: ev.clientX, y: ev.clientY })
    }
    const el = overlayRef.current
    el.addEventListener('pointerdown', handler, true)
    return () => el.removeEventListener('pointerdown', handler, true)
  }, [mapDebug])

  React.useEffect(() => {
    if (!mapDebug) return
    const handler = (ev: PointerEvent) => {
      const top = document.elementFromPoint(ev.clientX, ev.clientY)
      const style = top ? getComputedStyle(top as Element) : null
      const path = ev.composedPath().slice(0, 8).map((n) => {
        const node = n as any
        return {
          tag: node?.tagName || 'unknown',
          className: node?.className || '',
          id: node?.id || '',
          dataset: node?.dataset || {},
        }
      })
      console.info('[WorldHub mapDebug] pointerdown global', {
        target: ev.target,
        topElement: top,
        topInfo: top
          ? {
            tag: (top as Element).tagName,
            className: (top as HTMLElement).className,
            id: (top as HTMLElement).id,
            dataset: (top as HTMLElement).dataset,
            pointerEvents: style?.pointerEvents,
            zIndex: style?.zIndex,
          }
          : null,
        path,
        coords: { x: ev.clientX, y: ev.clientY },
      })
    }
    window.addEventListener('pointerdown', handler, true)
    return () => window.removeEventListener('pointerdown', handler, true)
  }, [mapDebug])

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

  React.useEffect(() => {
    let canceled = false
    const manifestUrl = getDefaultGraphicPackManifestUrl()
    setIsLoadingPack(true)
    loadGraphicPack(manifestUrl)
      .then((loadedPack) => {
        if (canceled) return
        setPack(loadedPack)
        setPackError(null)
        const cfg = getWorldMapConfig(loadedPack.manifest.grade)
        setMapConfig(cfg)
      })
      .catch((err: any) => {
        if (canceled) return
        setPack(null)
        setPackError(err?.message || 'Pack graphique indisponible')
        if (typeof console !== 'undefined' && console?.warn) {
          console.warn('Graphic pack load failed', err)
        }
      })
      .finally(() => {
        if (!canceled) setIsLoadingPack(false)
      })
    return () => { canceled = true }
  }, [])

  React.useEffect(() => {
    if (!pack) return
    const cleanup = injectCssUrls(pack.cssUrls, pack.manifest.id)
    return cleanup
  }, [pack])

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

  React.useEffect(() => {
    let canceled = false
    const tags = zonesForFocusBiome.flatMap(z => z.tagIds)
    if (!playerUid || !tags.length) {
      setAvailableTags(null)
      return
    }
    ;(async () => {
      const entries = await Promise.all(tags.map(async (tagId) => {
        try {
          const list = await listExercisesByTag(tagId, { uid: playerUid })
          return list.length > 0 ? tagId : null
        } catch {
          return null
        }
      }))
      if (canceled) return
      const set = new Set(entries.filter(Boolean) as string[])
      setAvailableTags(set)
    })()
    return () => { canceled = true }
  }, [playerUid, zonesForFocusBiome])

  const zoneAnchors = React.useMemo(() => {
    if (!pack) return []
    const subjects = Array.from(new Set(BIOMES_SORTED.map(b => b.subject)))
    return subjects.flatMap(sub => resolveZoneAnchors(sub as any, pack.manifest))
  }, [pack])

  const hasBiomeMap = React.useCallback((biomeId: string, subject?: string | null) => {
    if (!pack) return false
    const biome = getBiome(biomeId as any)
    const subjectId = subject || biome?.subject
    const resolved = resolveBiomeMap(pack.manifest, pack.packRootUrl, biomeId, subjectId || undefined)
    return !!resolved
  }, [pack])

  const activeBiomeIdForZones = React.useMemo(() => {
    if (openBiomeId) return openBiomeId
    if (mapDebug) return highlightBiomeId
    return null
  }, [openBiomeId, highlightBiomeId, mapDebug])

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
      availableTags: availableTags || undefined,
      seed,
      lastAdvice: lastAdviceRef.current,
    })
  }, [availableTags, blockProgress, dailyDateKey, focusBiome, focusBiomeVisual, masteryByTag, playerUid, zonesForFocusBiome])

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

  const handlePurchaseCosmetic = async (cosmeticId: string) => {
    if (!playerUid) return
    setAtelierBusyId(cosmeticId)
    setAtelierError(null)
    setAtelierMessage(null)
    try {
      await purchaseCosmetic(playerUid, cosmeticId)
      setAtelierMessage('Acheté !')
    } catch (e: any) {
      setAtelierError(e?.message || 'Achat impossible')
    } finally {
      setAtelierBusyId(null)
    }
  }

  const handleEquipCosmetic = async (cosmeticId: string) => {
    if (!playerUid) return
    setAtelierBusyId(cosmeticId)
    setAtelierError(null)
    setAtelierMessage(null)
    try {
      await equipCosmetic(playerUid, cosmeticId)
      setAtelierMessage('Équipé !')
    } catch (e: any) {
      setAtelierError(e?.message || 'Équipement impossible')
    } finally {
      setAtelierBusyId(null)
    }
  }

  const npcGuide = NPC_CATALOG[npcId]
  const npcLine = npcAdvice ? getNpcLine(npcId, npcAdvice.messageKey as any, {}) : null
  const slotForType = (type: Cosmetic['type']) => {
    if (type === 'monument_skin_biome') return 'biomeMonumentSkin'
    if (type === 'monument_skin_zone') return 'zoneMonumentSkin'
    if (type === 'tile_effect') return 'tileEffect'
    return 'npcStyle'
  }
  const formatCosmeticClass = (base: string, id?: string | null) => id ? `${base} ${base}--${id.replace(/_/g, '-')}` : ''
  const biomeSkinClass = formatCosmeticClass('monument-skin', rewards.equippedCosmetics?.biomeMonumentSkin)
  const zoneSkinClass = formatCosmeticClass('monument-skin', rewards.equippedCosmetics?.zoneMonumentSkin)
  const tileEffectClass = formatCosmeticClass('tile-effect', rewards.equippedCosmetics?.tileEffect)
  const npcStyleClass = formatCosmeticClass('npc-style', rewards.equippedCosmetics?.npcStyle)
  const filteredCosmetics = COSMETICS_CATALOG.filter((c) => {
    if (cosmeticFilter === 'monuments') return c.type === 'monument_skin_biome' || c.type === 'monument_skin_zone'
    if (cosmeticFilter === 'effects') return c.type === 'tile_effect'
    if (cosmeticFilter === 'npc') return c.type === 'npc_style'
    return true
  })

  const renderBiomeTiles = () => {
    const worldMap = pack?.manifest?.maps?.world
    const worldWidth = worldMap?.width || pack?.manifest.map.width
    const worldHeight = worldMap?.height || pack?.manifest.map.height
    const items = biomeTiles.map(({ biome, masteredCount, total, biomeVisual }) => {
      const isHighlighted = highlightBiomeId === biome.id
      const className = `${biomeSkinClass} ${isHighlighted ? 'is-highlighted' : ''}`.trim()
      const anchorKey = `biome:${biome.id}`
      const baseAnchor = resolveBiomeAnchor(biome, pack?.manifest, mapConfig)
      const anchor = mapDebug && debugAnchors[anchorKey] ? debugAnchors[anchorKey] : baseAnchor
      const hasBiomeMap = !!(pack && resolveBiomeMap(pack.manifest, pack.packRootUrl, biome.id, biome.subject))
      const handleClick = () => {
        if (hasBiomeMap) {
          navigateFromWorld(
            `/biome/${biome.id}`,
            anchor || undefined,
            worldMapSize || { width: worldMap?.width || pack?.manifest.map.width, height: worldHeight },
          )
          return
        }
        setOpenBiomeId(biome.id)
        setOpenZone(null)
        setOpenBlock(null)
        setHighlightBiomeId(null)
        setHighlightZoneTheme(null)
      }
      return {
        biomeId: biome.id,
        anchor,
        anchorKey,
        element: (
          <BiomeTile
            key={biome.id}
            biome={biome}
            totalBlocks={total}
            masteredCount={masteredCount}
            monumentCount={biomeVisual.rebuild?.correctCount || 0}
            target={biomeVisual.rebuild?.target || 100}
            highlighted={isHighlighted}
            className={className}
            variant={pack && mapConfig ? 'compact' : 'default'}
            onClick={handleClick}
          />
        ),
        name: biome.name,
      }
    })

    if (pack && mapConfig) {
      const anchored = items.filter(it => it.anchor)
      if (anchored.length === 0) {
        return (
          <div className="grid2">
            {items.map((it) => it.element)}
          </div>
        )
      }
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div ref={overlayRef} style={{ position: 'absolute', inset: 0 }}>
            <MapOverlayLayout
              width={worldWidth || pack.manifest.map.width}
              height={worldHeight || pack.manifest.map.height}
              safeArea={pack.manifest.anchors?.world?.safeArea || pack.manifest.anchors?.safeArea}
            >
              {(toCssPos) => anchored.map(({ biomeId, anchor, element, name }) => (
                <div
                  key={biomeId}
                  style={{ ...toCssPos(anchor!), width: 'auto' }}
                  aria-label={`Ouvrir le biome ${name}`}
                >
                  {element}
                </div>
              ))}
            </MapOverlayLayout>
            {mapDebug && (
              <MapAnchorsDebugLayer
                width={pack.manifest.maps?.world?.width || pack.manifest.map.width}
                height={pack.manifest.maps?.world?.height || pack.manifest.map.height}
                anchors={anchored.map(a => ({ id: a.biomeId, anchor: a.anchor! }))}
                safeArea={pack.manifest.anchors?.world?.safeArea || pack.manifest.anchors?.safeArea}
                containerRef={overlayRef}
                onAnchorChange={(id, anchor) => {
                  setDebugAnchors(prev => ({ ...prev, [id]: anchor }))
                }}
              />
            )}
            {mapDebug && anchored.length > 0 && (
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="mc-button secondary"
                  onClick={() => {
                    const biomesObj: Record<string, { x: number, y: number, radius?: number }> = {}
                    anchored.forEach(a => {
                      biomesObj[a.biomeId] = {
                        x: Math.round(a.anchor!.x),
                        y: Math.round(a.anchor!.y),
                        ...(typeof a.anchor!.radius === 'number' ? { radius: Math.round(a.anchor!.radius) } : {}),
                      }
                    })
                    const payload = {
                      anchors: {
                        world: {
                          ...(pack.manifest.anchors?.world?.safeArea ? { safeArea: pack.manifest.anchors.world.safeArea } : {}),
                          biomes: biomesObj,
                        },
                      },
                    }
                    const json = JSON.stringify(payload, null, 2)
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(json).catch(() => {})
                    } else {
                      prompt('Copier les anchors dans pack.json', json)
                    }
                  }}
                >
                  Copy JSON
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }
    return (
      <div className="grid2">
        {items.map((it) => it.element)}
      </div>
    )
  }

  const openZoneDrawer = (biomeId: string, theme: string) => {
    if (isBiomeRouteFromWindow()) {
      console.warn('GLOBAL DRAWER OPEN BLOCKED on /biome route', { biomeId, theme, pathname: typeof window !== 'undefined' ? window.location.pathname : '' })
      return
    }
    if (typeof console !== 'undefined') {
      console.warn('GLOBAL DRAWER OPEN CALLED', { biomeId, theme, pathname: typeof window !== 'undefined' ? window.location.pathname : '' })
    }
    setOpenBiomeId(biomeId)
    setOpenZone({ biomeId, theme })
    setOpenBlock(null)
    setHighlightBiomeId(biomeId)
    setHighlightZoneTheme(theme)
    setShowZonesOnMap(true)
  }

  const renderZoneChips = (zoneAnchors: ReturnType<typeof resolveZoneAnchors>, safeArea?: { left?: number; right?: number; top?: number; bottom?: number }) => {
    if (!pack || !mapConfig) return null
    if (!zoneAnchors.length) return null
    if (!activeBiomeIdForZones && !mapDebug) return null

    const filteredZones = zoneAnchors.filter(z => {
      if (mapDebug) return true
      const biome = activeBiomeIdForZones ? getBiome(activeBiomeIdForZones as any) : null
      return biome && biome.subject === z.subjectId
    })
    if (!filteredZones.length) return null

    const chips = filteredZones.map((zone) => {
      const anchorKey = `zone:${zone.subjectId}:${zone.themeLabel}`
      const anchor = (mapDebug && debugAnchors[anchorKey]) ? debugAnchors[anchorKey] : zone.anchor
      const progress = computeZoneProgress(zone, { blockProgress, zoneRebuildProgress })
      const highlighted = highlightZoneTheme && highlightZoneTheme === zone.themeLabel
      const targetBiomeId = activeBiomeIdForZones || subjectToBiomeId(zone.subjectId)
      return {
        id: anchorKey,
        anchor,
        element: (
          <ZoneMonumentChip
            key={anchorKey}
            label={zone.themeLabel}
            progress0to100={progress.progressPct}
            state={progress.state}
            highlighted={highlighted}
            onClick={() => {
              if (!targetBiomeId) return
              const hasMap = pack && resolveBiomeMap(pack.manifest, pack.packRootUrl, targetBiomeId, zone.subjectId)
              if (hasMap) {
                const params = new URLSearchParams()
                params.set('zone', zone.zoneKey || zone.themeLabel)
                navigateFromWorld(
                  `/biome/${targetBiomeId}?${params.toString()}`,
                  anchor || undefined,
                  worldMapSize || {
                    width: pack?.manifest.maps?.world?.width || pack?.manifest.map.width,
                    height: pack?.manifest.maps?.world?.height || pack?.manifest.map.height,
                  },
                )
                return
              }
              openZoneDrawer(targetBiomeId, zone.themeLabel)
            }}
          />
        ),
      }
    }).filter(z => z.anchor)

    if (!chips.length) return null
    return (
      <MapOverlayLayout
        width={pack.manifest.maps?.world?.width || pack.manifest.map.width}
        height={pack.manifest.maps?.world?.height || pack.manifest.map.height}
        safeArea={safeArea}
      >
        {(toCssPos) => chips.map(({ id, anchor, element }) => (
          <div key={id} style={{ ...toCssPos(anchor!), width: '14%', pointerEvents: 'auto', zIndex: 1 }}>
            {element}
          </div>
        ))}
      </MapOverlayLayout>
    )
  }

  return (
    <div
      className="container mc-worldhub-shell"
      data-pack-loading={isLoadingPack ? 'true' : 'false'}
      data-pack-error={packError || ''}
    >
      <div className="grid mc-worldhub-content">
        <div className="grid2">
          <PlayerHudCompact
            rewards={rewards}
            streak={streak}
            equippedAvatarId={equippedAvatarId}
            onOpenCollection={() => setOpenCollection(true)}
            onChangeNpc={() => setShowNpcPicker(true)}
          />
          {!isObserver && (
            <div className={`card mc-card ${npcStyleClass}`}>
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
              <div className={`mc-card ${npcStyleClass}`} style={{ marginTop: 10, border: '2px solid var(--mc-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div className="small" style={{ color: 'var(--mc-muted)' }}>Guide MaloCraft</div>
                      <div style={{ fontWeight: 800 }}>{npcAdvice?.message || npcLine?.text || 'Choisis un biome pour commencer.'}</div>
                    </div>
                  {npcAdvice?.ctaLabel && (
                    <button className="mc-button" onClick={() => {
                      if (focusBiome && hasBiomeMap(focusBiome.id, focusBiome.subject)) {
                        const anchor = resolveBiomeAnchor(focusBiome, pack?.manifest, mapConfig)
                        navigateFromWorld(
                          `/biome/${focusBiome.id}`,
                          anchor || undefined,
                          worldMapSize || undefined,
                        )
                        return
                      }
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
            className={npcStyleClass}
          />
        )}

        {!isObserver && (
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="mc-button secondary" onClick={() => setOpenChest(true)}>🎒 Inventaire</button>
            <button className="mc-button secondary" onClick={() => setOpenCollection(true)}>🏅 Collection</button>
            <button className="mc-button" onClick={() => setOpenAtelier(true)}>🛠️ Atelier</button>
            <span className="mc-chip gold">🪙 {rewards.coins || 0}</span>
          </div>
        )}

        {pack && mapConfig ? (
          <div style={{ position: 'relative', aspectRatio: `${(pack.manifest.maps?.world?.width || pack.manifest.map.width)}/${(pack.manifest.maps?.world?.height || pack.manifest.map.height)}`, width: '100%', overflow: 'hidden' }}>
            <MapBaseLayer
              baseLayerUrl={pack.baseLayerUrl}
              width={pack.manifest.maps?.world?.width || pack.manifest.map.width}
              height={pack.manifest.maps?.world?.height || pack.manifest.map.height}
            />
            <div ref={overlayRef} style={{ position: 'absolute', inset: 0 }}>
              {!mapDebug && showZonesOnMap && renderZoneChips(zoneAnchors, pack.manifest.anchors?.world?.safeArea || pack.manifest.anchors?.safeArea)}
              {(() => {
                const anchored = biomeTiles.map(({ biome, masteredCount, total, biomeVisual }) => {
                  const isHighlighted = highlightBiomeId === biome.id
                  const baseAnchor = resolveBiomeAnchor(biome, pack?.manifest, mapConfig)
                  const anchorKey = `biome:${biome.id}`
                  const anchor = mapDebug && debugAnchors[anchorKey] ? debugAnchors[anchorKey] : baseAnchor
                  const progressPct = total > 0 ? Math.round((masteredCount / total) * 100) : 0
                  const blocksForBiome = getBlocksForBiome(biome.id)
                  const latestBlockTs = blocksForBiome.reduce((acc, block) => {
                    const ts = toMillis(rewards.blockProgress?.[block.tagId]?.updatedAt)
                    return ts && ts > acc ? ts : acc
                  }, 0)
                  const biomeRebuildEntry = rewards.biomeRebuildProgress?.[biome.subject]
                  const rebuildPct = biomeRebuildEntry ? Math.round((biomeRebuildEntry.correctCount / (biomeRebuildEntry.target || 100)) * 100) : progressPct
                  const lastActivity = biomeRebuildEntry?.updatedAt || biomeRebuildEntry?.rebuiltAt || (latestBlockTs ? new Date(latestBlockTs) : undefined)
                  const biomeState = computeBiomeVisualState({
                    biomeRebuiltPct: rebuildPct,
                    biomeLastActivityAt: lastActivity || undefined,
                    now: nowRef.current,
                  })
                  return {
                    biomeId: biome.id,
                    anchor,
                    anchorKey,
                    name: biome.name,
                    element: (
                      <BiomePOI
                        biomeId={biome.id}
                        subjectId={biome.subject as any}
                        label={biome.name}
                        progressPct={progressPct}
                        state={biomeState}
                        isHighlighted={isHighlighted}
                        anchor={anchor || undefined}
                        packBaseUrl={pack?.packRootUrl}
                        debug={mapDebug}
                        onOpen={() => {
                          const resolved = pack ? resolveBiomeMap(pack.manifest, pack.packRootUrl, biome.id, biome.subject) : null
                          if (resolved) {
                            navigateFromWorld(
                              `/biome/${biome.id}`,
                              anchor || undefined,
                              worldMapSize || {
                                width: pack?.manifest.maps?.world?.width || pack?.manifest.map.width,
                                height: pack?.manifest.maps?.world?.height || pack?.manifest.map.height,
                              },
                            )
                            return
                          }
                          setOpenBiomeId(biome.id)
                          setOpenZone(null)
                          setOpenBlock(null)
                          setHighlightBiomeId(null)
                          setHighlightZoneTheme(null)
                        }}
                      />
                    ),
                  }
                }).filter(it => it.anchor)

                return (
                  <>
                    {mapDebug && console.info('[WorldHub mapDebug] anchored biomes', anchored.map(a => ({ id: a.biomeId, x: Math.round(a.anchor!.x), y: Math.round(a.anchor!.y) })))}
                    <div style={{ pointerEvents: 'auto' }}>
                      <MapOverlayLayout
                        width={pack.manifest.maps?.world?.width || pack.manifest.map.width}
                        height={pack.manifest.maps?.world?.height || pack.manifest.map.height}
                        safeArea={pack.manifest.anchors?.world?.safeArea || pack.manifest.anchors?.safeArea}
                      >
                        {(toCssPos) => anchored.map(({ biomeId, anchor, element, name }) => (
                          <div
                            key={biomeId}
                            style={{ ...toCssPos(anchor!), pointerEvents: mapDebug ? 'none' : 'auto', width: 'auto' }}
                            aria-label={`Ouvrir le biome ${name}`}
                          >
                            {element}
                          </div>
                        ))}
                      </MapOverlayLayout>
                    </div>
                    {mapDebug && (
                      <MapAnchorsDebugLayer
                        width={pack.manifest.map.width}
                        height={pack.manifest.map.height}
                        anchors={[
                          ...anchored.map(a => ({ id: a.anchorKey, anchor: a.anchor! })),
                        ]}
                        safeArea={pack.manifest.anchors?.world?.safeArea || pack.manifest.anchors?.safeArea}
                        containerRef={overlayRef}
                        onAnchorChange={(id, anchor) => {
                          setDebugAnchors(prev => ({ ...prev, [id]: anchor }))
                        }}
                      />
                    )}
                    {mapDebug && (
                      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          className="mc-button secondary"
                          onClick={() => {
                            const biomesObj: Record<string, { x: number, y: number, radius?: number }> = {}
                            anchored.forEach(a => {
                              biomesObj[a.biomeId] = {
                                x: Math.round(a.anchor!.x),
                                y: Math.round(a.anchor!.y),
                                ...(typeof a.anchor!.radius === 'number' ? { radius: Math.round(a.anchor!.radius) } : {}),
                              }
                            })
                            const zonesObj: Record<string, Record<string, { x: number, y: number, radius?: number }>> = {}
                            zoneAnchors.forEach(z => {
                              const key = `zone:${z.subjectId}:${z.themeLabel}`
                              const anchor = (mapDebug && debugAnchors[key]) || z.anchor
                              if (!zonesObj[z.subjectId]) zonesObj[z.subjectId] = {}
                              zonesObj[z.subjectId][z.themeLabel] = {
                                x: Math.round(anchor.x),
                                y: Math.round(anchor.y),
                                ...(typeof anchor.radius === 'number' ? { radius: Math.round(anchor.radius) } : {}),
                              }
                            })
                            const payload = {
                              anchors: {
                                world: {
                                  ...(pack.manifest.anchors?.world?.safeArea ? { safeArea: pack.manifest.anchors.world.safeArea } : {}),
                                  ...(Object.keys(biomesObj).length ? { biomes: biomesObj } : {}),
                                },
                                ...(Object.keys(zonesObj).length
                                  ? { biomes: Object.fromEntries(Object.entries(zonesObj).map(([subjectId, byTheme]) => ([subjectId, { zones: byTheme }])))} : {}),
                              },
                            }
                            const json = JSON.stringify(payload, null, 2)
                            const doPrompt = () => prompt('Copier les anchors dans pack.json', json)
                            const copyViaTextarea = () => {
                              const ta = document.createElement('textarea')
                              ta.value = json
                              ta.style.position = 'fixed'
                              ta.style.opacity = '0'
                              document.body.appendChild(ta)
                              ta.select()
                              try {
                                document.execCommand('copy')
                                console.info('[WorldHub mapDebug] anchors copied via execCommand')
                              } catch (err) {
                                console.warn('[WorldHub mapDebug] execCommand copy failed', err)
                                doPrompt()
                              } finally {
                                document.body.removeChild(ta)
                              }
                            }
                            if (navigator?.clipboard?.writeText) {
                              navigator.clipboard.writeText(json)
                                .then(() => console.info('[WorldHub mapDebug] anchors copied to clipboard'))
                                .catch((err) => {
                                  console.warn('[WorldHub mapDebug] clipboard.writeText failed', err)
                                  copyViaTextarea()
                                })
                            } else {
                              copyViaTextarea()
                            }
                          }}
                        >
                          Copy JSON
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        ) : (
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
                className={biomeSkinClass}
                onClick={() => {
                  const hasBiomeMap = !!(pack && resolveBiomeMap(pack.manifest, pack.packRootUrl, biome.id, biome.subject))
                  if (hasBiomeMap) {
                    navigateFromWorld(
                      `/biome/${biome.id}`,
                      undefined,
                      worldMapSize || undefined,
                    )
                  } else {
                    setOpenBiomeId(biome.id)
                    setOpenZone(null)
                    setOpenBlock(null)
                    setHighlightBiomeId(null)
                    setHighlightZoneTheme(null)
                  }
                }}
              />
            ))}
          </div>
        )}

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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="small" style={{ color: 'var(--mc-muted)' }}>Quartiers sur la carte</div>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={showZonesOnMap} onChange={(e) => setShowZonesOnMap(e.target.checked)} />
            Voir
          </label>
        </div>
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
              className={biomeSkinClass}
            />
          )}
          <ZoneTilesGrid
            zones={biomeZones}
            highlightedTheme={highlightZoneTheme}
            className={zoneSkinClass}
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
                className={zoneSkinClass}
              />
              <div style={{ marginTop: 10 }}>
                <ZoneBlocksGrid blocks={selectedZoneData.blocks.map(b => ({
                  tagId: b.tagId,
                  label: getTagMeta(b.tagId).label,
                  description: b.description,
                  visual: b.visual,
                }))} className={tileEffectClass} onSelect={(tagId) => setOpenBlock({ tagId, biomeId: selectedBiome.id })} />
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

        <Drawer
          open={openAtelier}
          onClose={() => { setOpenAtelier(false); setAtelierMessage(null); setAtelierError(null); setAtelierBusyId(null) }}
          title="Atelier"
          zIndex={970}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div>
              <div className="small" style={{ color: 'var(--mc-muted)' }}>Solde</div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span className="mc-chip gold">🪙 {rewards.coins || 0}</span>
                <span className="mc-chip">Niveau {rewards.level || 1}</span>
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'Tous' },
                { id: 'monuments', label: 'Monuments' },
                { id: 'effects', label: 'Effets' },
                { id: 'npc', label: 'PNJ' },
              ].map(f => (
                <button
                  key={f.id}
                  className={`mc-chip ${cosmeticFilter === f.id ? 'accent' : ''}`}
                  onClick={() => setCosmeticFilter(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {atelierMessage && <div className="small" style={{ color: '#7fffb2', marginBottom: 8 }}>{atelierMessage}</div>}
          {atelierError && <div className="small" style={{ color: '#ff9fb0', marginBottom: 8 }}>{atelierError}</div>}
          <div className="grid2">
            {filteredCosmetics.map((item) => {
              const owned = isCosmeticOwned(item, rewards)
              const equipped = rewards.equippedCosmetics?.[slotForType(item.type)] === item.id
              const locked = !owned && !!item.unlockLevel && (rewards.level || 1) < item.unlockLevel
              const purchasable = !owned && typeof item.costCoins === 'number' && !locked
              const canBuy = purchasable && (rewards.coins || 0) >= (item.costCoins || 0)
              const previewClass = item.type === 'tile_effect'
                ? formatCosmeticClass('tile-effect', item.id)
                : item.type === 'npc_style'
                  ? formatCosmeticClass('npc-style', item.id)
                  : formatCosmeticClass('monument-skin', item.id)
              const typeIcon = item.type === 'tile_effect'
                ? '✨'
                : item.type === 'npc_style'
                  ? '🗨️'
                  : '🏛️'
              return (
                <div key={item.id} className={`mc-card ${previewClass}`} style={{ position: 'relative', overflow: 'hidden' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div className="small" style={{ color: 'var(--mc-muted)' }}>{typeIcon} {item.type === 'npc_style' ? 'PNJ' : item.type === 'tile_effect' ? 'Effet' : 'Monument'}</div>
                      <div style={{ fontWeight: 900 }}>{item.label}</div>
                      <div className="small" style={{ color: 'var(--mc-muted)' }}>{item.description}</div>
                    </div>
                    {equipped && <span className="mc-chip accent">Équipé</span>}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {typeof item.costCoins === 'number' && (
                      <span className="mc-chip gold">🪙 {item.costCoins}</span>
                    )}
                    {item.unlockLevel && (
                      <span className={`mc-chip ${owned ? 'accent' : 'muted'}`}>Niveau {item.unlockLevel}</span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {locked && <span className="mc-chip muted">Niveau {item.unlockLevel} requis</span>}
                    {!locked && !owned && purchasable && (
                      <button
                        className="mc-button"
                        disabled={!canBuy || atelierBusyId === item.id}
                        onClick={() => handlePurchaseCosmetic(item.id)}
                      >
                        {canBuy ? `Acheter (${item.costCoins} coins)` : 'Manque de coins'}
                      </button>
                    )}
                    {!locked && owned && !equipped && (
                      <button
                        className="mc-button secondary"
                        disabled={atelierBusyId === item.id}
                        onClick={() => handleEquipCosmetic(item.id)}
                      >
                        Équiper
                      </button>
                    )}
                    {owned && !purchasable && !equipped && !locked && (
                      <span className="mc-chip accent">Débloqué</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Drawer>

        <Drawer open={openChest} onClose={() => setOpenChest(false)} title="Coffre" zIndex={980}>
          <ChestContent />
        </Drawer>

        <Drawer open={openCollection} onClose={() => setOpenCollection(false)} title="Collection" zIndex={980}>
          <CollectionContent />
        </Drawer>

      </div>
    </div>
  )
}
