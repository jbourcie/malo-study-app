import { Timestamp, arrayUnion, collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import type { FamilyLink, PairingCodeRecord, Role } from '../types'
import { arrayRemove } from 'firebase/firestore'

export const PAIRING_CODE_TTL_MINUTES = 10

const CODE_LENGTH = 8
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type PairingErrorCode = 'code_not_found' | 'code_expired' | 'code_used' | 'invalid_child' | 'already_linked'

export class PairingError extends Error {
  code: PairingErrorCode
  constructor(code: PairingErrorCode, message?: string) {
    super(message || code)
    this.code = code
  }
}

export function normalizePairingCode(raw: string): string {
  return (raw || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function generatePairingCodeValue(rng: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(rng() * CODE_CHARSET.length) % CODE_CHARSET.length
    code += CODE_CHARSET[idx]
  }
  return code
}

export function computeExpiry(now: Date = new Date(), ttlMinutes: number = PAIRING_CODE_TTL_MINUTES) {
  return Timestamp.fromDate(new Date(now.getTime() + ttlMinutes * 60 * 1000))
}

export function ensurePairingAvailable(doc: PairingCodeRecord | null, now: Date = new Date()) {
  if (!doc) throw new PairingError('code_not_found', 'Code introuvable ou expiré')
  if (doc.used) throw new PairingError('code_used', 'Code déjà utilisé')
  const expiresAt = (doc.expiresAt as Timestamp | null)
  if (expiresAt && expiresAt.toDate().getTime() <= now.getTime()) {
    throw new PairingError('code_expired', 'Code expiré')
  }
}

export function familyLinkId(parentId: string, childId: string) {
  return `${parentId}_${childId}`
}

export type LinkedChild = {
  id: string
  displayName: string
  role: Role
}

export async function createPairingCodeForChild(childUid: string, now: Date = new Date()) {
  const code = generatePairingCodeValue()
  const expiresAt = computeExpiry(now)
  const ref = doc(db, 'pairingCodes', code)
  await setDoc(ref, {
    code,
    childUid,
    createdAt: serverTimestamp(),
    expiresAt,
    used: false,
    usedBy: null,
    consumedAt: null,
  })
  return { code, expiresAt }
}

export async function redeemPairingCode(codeInput: string, parentId: string, now: Date = new Date()) {
  const code = normalizePairingCode(codeInput)
  if (!code) throw new PairingError('code_not_found', 'Code introuvable ou expiré')
  const codeRef = doc(db, 'pairingCodes', code)

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(codeRef)
    const data = snap.exists() ? ({ code, ...(snap.data() as any) } as PairingCodeRecord) : null
    ensurePairingAvailable(data, now)

    const childUid = data!.childUid
    const linkRef = doc(db, 'familyLinks', familyLinkId(parentId, childUid))
    const existingLink = await tx.get(linkRef)
    if (existingLink.exists()) {
      throw new PairingError('already_linked', 'Enfant déjà rattaché')
    }

    tx.update(codeRef, {
      used: true,
      usedBy: parentId,
      consumedAt: serverTimestamp(),
    })

    tx.set(linkRef, {
      parentId,
      childId: childUid,
      pairingCode: code,
      createdAt: serverTimestamp(),
    } satisfies FamilyLink)

    // Soft linkage in profiles to help with future queries (idempotent)
    const parentRef = doc(db, 'users', parentId)
    tx.set(parentRef, { childrenIds: arrayUnion(childUid) }, { merge: true })
    const childRef = doc(db, 'users', childUid)
    tx.set(childRef, { parents: arrayUnion(parentId) }, { merge: true })

    return { childUid }
  })

  return result
}

export async function listLinkedChildren(parentId: string): Promise<LinkedChild[]> {
  const linksSnap = await getDocs(query(
    collection(db, 'familyLinks'),
    where('parentId', '==', parentId)
  ))
  const children: LinkedChild[] = []
  for (const link of linksSnap.docs) {
    const childId = (link.data() as FamilyLink).childId
    const childSnap = await getDoc(doc(db, 'users', childId))
    const data = childSnap.data() as any | undefined
    children.push({
      id: childId,
      displayName: data?.displayName || 'Enfant',
      role: (data?.role || 'child') as Role,
    })
  }
  return children
}

export async function unlinkChildFromParent(parentId: string, childId: string) {
  const linkRef = doc(db, 'familyLinks', familyLinkId(parentId, childId))
  await runTransaction(db, async (tx) => {
    const linkSnap = await tx.get(linkRef)
    if (!linkSnap.exists()) return
    const data = linkSnap.data() as FamilyLink
    if (data.parentId !== parentId || data.childId !== childId) return

    tx.delete(linkRef)
    const parentRef = doc(db, 'users', parentId)
    const childRef = doc(db, 'users', childId)
    tx.set(parentRef, { childrenIds: arrayRemove(childId) }, { merge: true })
    tx.set(childRef, { parents: arrayRemove(parentId) }, { merge: true })
  })
}
