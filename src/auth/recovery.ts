import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { EmailAuthProvider, linkWithCredential, signInAnonymously, signInWithEmailAndPassword, User } from 'firebase/auth'
import { db, auth } from '../firebase'
import { normalizePairingCode } from './pairing'

const RECOVERY_CODE_LENGTH = 20
const RECOVERY_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RECOVERY_TTL_MS = 30 * 24 * 3600 * 1000

function generateRecoveryCode(rng: () => number = Math.random) {
  let code = ''
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    const idx = Math.floor(rng() * RECOVERY_CHARSET.length) % RECOVERY_CHARSET.length
    code += RECOVERY_CHARSET[idx]
  }
  return code
}

function recoveryEmail(childUid: string) {
  return `child-${childUid}@child.malocraft`
}

export async function ensureRecoveryCodeForChild(child: User): Promise<string> {
  // 1) check if already set in meta
  const metaRef = doc(db, 'users', child.uid, 'meta', 'recovery')
  const metaSnap = await getDoc(metaRef)
  const existing = metaSnap.exists() ? (metaSnap.data() as any).code : null
  if (existing) {
    const recSnap = await getDoc(doc(db, 'childRecoveryCodes', existing))
    const data = recSnap.exists() ? recSnap.data() as any : null
    const expiresAt = data?.expiresAt?.toDate ? data.expiresAt.toDate() : data?.expiresAt
    const valid = data && data.revoked !== true && expiresAt && expiresAt.getTime() > Date.now()
    if (valid) return existing as string
  }

  const code = generateRecoveryCode()
  // 2) store mapping code -> childUid
  await setDoc(doc(db, 'childRecoveryCodes', code), {
    childUid: child.uid,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + RECOVERY_TTL_MS),
    revoked: false,
  })
  // 3) link auth account with email/password so the same UID est réutilisé
  const email = recoveryEmail(child.uid)
  const cred = EmailAuthProvider.credential(email, code)
  const hasPasswordProvider = (child.providerData || []).some((p) => p?.providerId === 'password')
  if (!hasPasswordProvider) {
    // Première liaison sur un compte anonyme
    try {
      await linkWithCredential(child, cred)
    } catch {
      // Si ça échoue (rare), on ne force pas la rotation
    }
  }
  await setDoc(metaRef, { code, email }, { merge: true })
  return code
}

export async function regenerateRecoveryCodeForChild(child: User): Promise<string> {
  const metaRef = doc(db, 'users', child.uid, 'meta', 'recovery')
  const metaSnap = await getDoc(metaRef)
  const oldCode = metaSnap.exists() ? (metaSnap.data() as any).code : null
  if (oldCode) {
    await setDoc(doc(db, 'childRecoveryCodes', oldCode), { revoked: true, revokedAt: serverTimestamp() }, { merge: true })
  }
  return ensureRecoveryCodeForChild(child)
}

export function validateRecoveryDoc(data: any, now: Date = new Date()) {
  if (!data) throw new Error('Code invalide ou inconnu')
  if (data.revoked) throw new Error('Code révoqué')
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : data?.expiresAt
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) throw new Error('Code expiré')
}

export async function signInChildWithRecoveryCode(rawCode: string) {
  const code = normalizePairingCode(rawCode)
  if (!code) throw new Error('Code requis')
  if (!auth.currentUser) {
    // connexion anonyme préalable requise par les règles
    await signInAnonymously(auth)
  }
  const snap = await getDoc(doc(db, 'childRecoveryCodes', code))
  if (!snap.exists()) throw new Error('Code invalide ou inconnu')
  const data = snap.data() as any
  validateRecoveryDoc(data)
  const childUid = data.childUid as string
  if (!childUid) throw new Error('Code invalide')
  const email = recoveryEmail(childUid)
  const cred = await signInWithEmailAndPassword(auth, email, code)
  // Pas de rotation automatique ici pour éviter les erreurs de reconnection; le code reste utilisable
  return cred
}

export async function getRecoveryCodeForChild(childUid: string): Promise<string | null> {
  const metaRef = doc(db, 'users', childUid, 'meta', 'recovery')
  const metaSnap = await getDoc(metaRef)
  if (!metaSnap.exists()) return null
  const code = (metaSnap.data() as any).code
  if (typeof code !== 'string') return null
  const recSnap = await getDoc(doc(db, 'childRecoveryCodes', code))
  const data = recSnap.exists() ? recSnap.data() as any : null
  const expiresAt = data?.expiresAt?.toDate ? data.expiresAt.toDate() : data?.expiresAt
  const valid = data && data.revoked !== true && expiresAt && expiresAt.getTime() > Date.now()
  return valid ? code : null
}
