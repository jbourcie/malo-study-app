import { TAG_CATALOG } from '../../taxonomy/tagCatalog'

const STORAGE_KEY = 'npcPriorityTags'

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function getDefaultPriorityTags(): string[] {
  return Object.keys(TAG_CATALOG)
}

function storageKey(childId?: string | null) {
  return childId ? `${STORAGE_KEY}:${childId}` : STORAGE_KEY
}

export function getPriorityTags(childId?: string | null): string[] {
  const all = getDefaultPriorityTags()
  if (!isBrowser()) return all
  try {
    const raw = localStorage.getItem(storageKey(childId || undefined)) || localStorage.getItem(STORAGE_KEY)
    if (!raw) return all
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return all
    const set = new Set<string>(all)
    const cleaned = parsed.filter((t: any) => typeof t === 'string' && set.has(t))
    return cleaned.length ? cleaned : all
  } catch {
    return all
  }
}

export function setPriorityTags(tags: string[], childId?: string | null): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(storageKey(childId || undefined), JSON.stringify(tags))
  } catch {
    // ignore storage errors
  }
}
