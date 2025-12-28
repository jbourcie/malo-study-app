import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { TAG_CATALOG } from '../taxonomy/tagCatalog'

const DEFAULT_TAGS = Object.keys(TAG_CATALOG)

export async function loadNpcPriorityTags(childId: string | null | undefined): Promise<string[]> {
  if (!childId) return DEFAULT_TAGS
  try {
    const ref = doc(db, 'users', childId, 'meta', 'npcPriorities')
    const snap = await getDoc(ref)
    if (!snap.exists()) return DEFAULT_TAGS
    const data = snap.data() as any
    const tags = Array.isArray(data?.tags) ? data.tags : []
    const set = new Set(DEFAULT_TAGS)
    const cleaned = tags.filter((t: any) => typeof t === 'string' && set.has(t))
    return cleaned.length ? cleaned : DEFAULT_TAGS
  } catch {
    return DEFAULT_TAGS
  }
}

export async function saveNpcPriorityTags(childId: string, tags: string[]): Promise<void> {
  if (!childId) return
  const set = new Set(DEFAULT_TAGS)
  const cleaned = tags.filter((t) => set.has(t))
  await setDoc(doc(db, 'users', childId, 'meta', 'npcPriorities'), { tags: cleaned }, { merge: true })
}
