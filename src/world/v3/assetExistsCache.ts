const assetExistsMap = new Map<string, boolean>()

async function probe(url: string, method: 'HEAD' | 'GET'): Promise<boolean> {
  try {
    const res = await fetch(url, { method, cache: 'no-store' })
    if (res.ok) return true
    if (res.status === 404) return false
  } catch {
    // ignored: treated as missing, GET fallback may still succeed
  }
  return false
}

export async function assetExists(url: string): Promise<boolean> {
  if (assetExistsMap.has(url)) return assetExistsMap.get(url) as boolean
  const exists = (await probe(url, 'HEAD')) || (await probe(url, 'GET'))
  assetExistsMap.set(url, exists)
  return exists
}

export function setAssetExistence(url: string, exists: boolean) {
  assetExistsMap.set(url, exists)
}

export function clearAssetExistenceCache() {
  assetExistsMap.clear()
}
