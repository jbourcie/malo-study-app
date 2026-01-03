import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { slugifyZoneLabel } from '../src/world/slug.ts'
import { getTagMeta } from '../src/taxonomy/tagCatalog.ts'
import type { GraphicPackManifest } from '../src/world/graphicPacks/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PACK_PATH = path.join(ROOT, 'public/assets/graphic-packs/pack-5e-mvp/pack.json')

const DEFAULT_SAFE_AREA = { left: 60, top: 60, right: 60, bottom: 60 }
const DEFAULT_RADIUS = 24
const DISTANCE_THRESHOLD = 90
const GRID_DX = 140
const GRID_DY = 120
const MAX_SLOT_ATTEMPTS = 40
const START_X_RATIO = 0.4
const START_Y_RATIO = 0.45

type Point = { x: number; y: number }
type AnchorBlock = { x: number; y: number; radius: number }

export function extractNewTagIdsFromDiff(diff: string): string[] {
  const tagIds = new Set<string>()
  const regex = /^\+\s*(fr_[a-z0-9_]+):\s*{/
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('@@')) continue
    const match = line.match(regex)
    if (match) tagIds.add(match[1])
  }
  return [...tagIds]
}

export function detectNewFrTags(): string[] {
  const diff = execSync('git diff HEAD~1 HEAD -- src/taxonomy/tagCatalog.ts', {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const tagIds = extractNewTagIdsFromDiff(diff)
  return tagIds.filter((id) => getTagMeta(id).subject === 'fr')
}

export function resolveZoneKey(tagId: string): string {
  const meta = getTagMeta(tagId)
  return `${meta.subject}:${slugifyZoneLabel(meta.theme)}`
}

function parseCliTags(): string[] | undefined {
  const direct = process.argv.find((arg) => arg.startsWith('--tags='))
  if (direct) {
    return direct
      .slice('--tags='.length)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
  const flagIndex = process.argv.indexOf('--tags')
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1]
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function hashTagId(tagId: string): number {
  return [...tagId].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0)
}

function nextSlotPosition(
  tagId: string,
  width: number,
  height: number,
  safeArea: Required<typeof DEFAULT_SAFE_AREA>,
  occupied: Point[],
): Point {
  const startX = width * START_X_RATIO
  const startY = height * START_Y_RATIO

  for (let i = 0; i < MAX_SLOT_ATTEMPTS; i += 1) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const rawX = startX + col * GRID_DX
    const rawY = startY + row * GRID_DY
    const x = clamp(rawX, safeArea.left, width - safeArea.right)
    const y = clamp(rawY, safeArea.top, height - safeArea.bottom)
    const candidate = { x: Math.round(x), y: Math.round(y) }
    if (occupied.every((p) => distance(p, candidate) >= DISTANCE_THRESHOLD)) {
      return candidate
    }
  }

  const centerX = clamp(width / 2, safeArea.left, width - safeArea.right)
  const centerY = clamp(height / 2, safeArea.top, height - safeArea.bottom)
  const hash = hashTagId(tagId)
  const offsetX = ((hash % 120) - 60)
  const offsetY = (((hash >> 8) % 120) - 60)
  return {
    x: Math.round(clamp(centerX + offsetX, safeArea.left, width - safeArea.right)),
    y: Math.round(clamp(centerY + offsetY, safeArea.top, height - safeArea.bottom)),
  }
}

function ensureAnchors(manifest: GraphicPackManifest) {
  if (!manifest.anchors) manifest.anchors = {}
  if (!manifest.anchors.zones) manifest.anchors.zones = {}
}

function ensureZoneEntry(manifest: GraphicPackManifest, zoneKey: string) {
  ensureAnchors(manifest)
  const zones = manifest.anchors!.zones!
  if (!zones[zoneKey]) {
    zones[zoneKey] = { safeArea: { ...DEFAULT_SAFE_AREA }, blocks: {} }
  } else {
    zones[zoneKey].safeArea = { ...DEFAULT_SAFE_AREA, ...zones[zoneKey].safeArea }
    zones[zoneKey].blocks = zones[zoneKey].blocks || {}
  }
}

function getZoneDimensions(manifest: GraphicPackManifest, zoneKey: string) {
  const zoneMap = manifest.maps?.zones?.[zoneKey]
  return {
    width: zoneMap?.width ?? 1920,
    height: zoneMap?.height ?? 1080,
  }
}

function collectOccupiedBlocks(zoneBlocks: Record<string, AnchorBlock | undefined>): Point[] {
  return Object.values(zoneBlocks)
    .filter(Boolean)
    .map((block) => ({ x: block!.x, y: block!.y }))
}

export function addAnchorsForTags(manifest: GraphicPackManifest, tagIds: string[]) {
  const added: { tagId: string; zoneKey: string; point: AnchorBlock }[] = []
  const sortedTags = [...tagIds].sort()

  for (const tagId of sortedTags) {
    const meta = getTagMeta(tagId)
    if (meta.subject !== 'fr') continue
    const zoneKey = resolveZoneKey(tagId)
    ensureZoneEntry(manifest, zoneKey)
    const zone = manifest.anchors!.zones![zoneKey]!
    zone.safeArea = { ...DEFAULT_SAFE_AREA, ...zone.safeArea }
    zone.blocks = zone.blocks || {}

    if (zone.blocks[tagId]) continue

    const { width, height } = getZoneDimensions(manifest, zoneKey)
    const occupied = collectOccupiedBlocks(zone.blocks)
    const safeArea = zone.safeArea as Required<typeof DEFAULT_SAFE_AREA>
    const point = nextSlotPosition(tagId, width, height, safeArea, occupied)
    zone.blocks[tagId] = { ...point, radius: DEFAULT_RADIUS }
    added.push({ tagId, zoneKey, point: zone.blocks[tagId]! })
  }

  return { manifest, added }
}

export function applyAnchorsToPack(packPath: string, tagIds: string[]) {
  const raw = fs.readFileSync(packPath, 'utf8')
  const normalizedOriginal = raw.endsWith('\n') ? raw : `${raw}\n`
  const manifest: GraphicPackManifest = JSON.parse(raw)
  const { added } = addAnchorsForTags(manifest, tagIds)
  const nextRaw = `${JSON.stringify(manifest, null, 2)}\n`
  const changed = nextRaw !== normalizedOriginal
  if (changed) {
    fs.writeFileSync(packPath, nextRaw, 'utf8')
  }
  return { added, changed, output: nextRaw }
}

export async function main() {
  const cliTags = parseCliTags()
  const newTags = cliTags ?? detectNewFrTags()
  if (newTags.length !== 3) {
    console.error(`Aborting: expected 3 new FR tags, found ${newTags.length} -> ${newTags.join(', ')}`)
    process.exit(1)
  }

  const { added, changed } = applyAnchorsToPack(PACK_PATH, newTags)
  if (!added.length) {
    console.log('No new anchors to add; anchors already present.')
    return
  }

  console.log(`Updated ${PACK_PATH} (${changed ? 'written' : 'unchanged'})`)
  for (const entry of added) {
    console.log(`- ${entry.tagId} -> ${entry.zoneKey} at (${entry.point.x}, ${entry.point.y})`)
  }
}

const invokedAsScript = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (invokedAsScript) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
