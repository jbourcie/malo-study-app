import React from 'react'
import { onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, User } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { auth, db, providerGoogle } from '../firebase'
import type { Role, UserProfile } from '../types'
import { createPairingCodeForChild, listLinkedChildren, redeemPairingCode as redeemPairingCodeTx, unlinkChildFromParent, type LinkedChild } from '../auth/pairing'
import { ensureRecoveryCodeForChild, getRecoveryCodeForChild, regenerateRecoveryCodeForChild, signInChildWithRecoveryCode } from '../auth/recovery'

type AuthState = {
  user: User | null
  profile: UserProfile | null
  role: Role | null
  loading: boolean
  linkedChildren: LinkedChild[]
  activeChildId: string | null
  activeChild: LinkedChild | null
  signInGoogle: () => Promise<void>
  startAnonymousWithName: (displayName: string) => Promise<void>
  resumeChildWithRecovery: (code: string) => Promise<void>
  signOutUser: () => Promise<void>
  setActiveChildId: (id: string | null) => void
  refreshLinkedChildren: () => Promise<void>
  generatePairingCode: () => Promise<{ code: string, expiresAt: any }>
  redeemPairingCode: (code: string) => Promise<{ childUid: string }>
  updateDisplayName: (name: string) => Promise<void>
  linkedParentName: string | null
  unlinkChild: (childId: string) => Promise<void>
  refreshRecoveryCode: (childId?: string | null, forceGenerate?: boolean) => Promise<void>
  regenerateRecoveryCode: () => Promise<void>
}

const Ctx = React.createContext<AuthState | null>(null)

function activeChildStorageKey(parentId: string) {
  return `malo.activeChild:${parentId}`
}
const childNameStorageKey = 'malo.childName'

async function fetchAllChildren(): Promise<LinkedChild[]> {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'child')))
  return snap.docs.map(d => ({
    id: d.id,
    displayName: (d.data() as any).displayName || 'Enfant',
    role: 'child' as Role,
  }))
}

function computeRole(u: User, existing?: Role | null): Role {
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
  const isAdminEmail = !u.isAnonymous && adminEmails.includes((u.email || '').toLowerCase())
  if (isAdminEmail) return 'admin'
  if (existing) return existing
  if (u.isAnonymous) return 'child'
  return 'parent'
}

async function ensureUserProfile(u: User, desiredDisplayName?: string | null): Promise<UserProfile> {
  const ref = doc(db, 'users', u.uid)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? (snap.data() as any) : null
  const role = computeRole(u, existing?.role as Role | null)
  const localName = desiredDisplayName || (typeof localStorage !== 'undefined' ? localStorage.getItem(childNameStorageKey) : null)
  const displayName = u.displayName || localName || existing?.displayName || (role === 'child' ? 'Enfant' : 'Parent')
  const profile: UserProfile = {
    uid: u.uid,
    role,
    email: u.email || existing?.email || null,
    displayName,
    parents: Array.isArray(existing?.parents) ? existing.parents : [],
    childrenIds: Array.isArray(existing?.childrenIds) ? existing.childrenIds : [],
  }
  await setDoc(ref, {
    displayName: profile.displayName,
    role,
    email: profile.email || null,
    createdAt: existing?.createdAt || serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true })
  return profile
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [role, setRole] = React.useState<Role | null>(null)
  const [linkedChildren, setLinkedChildren] = React.useState<LinkedChild[]>([])
  const [activeChildId, setActiveChildIdState] = React.useState<string | null>(null)
  const [activeChild, setActiveChild] = React.useState<LinkedChild | null>(null)
  const [loading, setLoading] = React.useState(true)
  const desiredDisplayNameRef = React.useRef<string | null>(null)
  const [linkedParentName, setLinkedParentName] = React.useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = React.useState<string | null>(null)

  const fetchRecoveryCode = React.useCallback(async (childId: string | null, forceGenerate?: boolean) => {
    if (!childId) {
      setRecoveryCode(null)
      return
    }
    try {
      if (forceGenerate && auth.currentUser && auth.currentUser.uid === childId) {
        const code = await ensureRecoveryCodeForChild(auth.currentUser)
        setRecoveryCode(code)
        return
      }
      const code = await getRecoveryCodeForChild(childId)
      setRecoveryCode(code)
    } catch {
      setRecoveryCode(null)
    }
  }, [])

  const refreshLinkedChildren = React.useCallback(async () => {
    if (!user || role === 'child' || !role) {
      setLinkedChildren([])
      setActiveChildIdState(user?.uid || null)
      return
    }
    const childrenList = role === 'admin' ? await fetchAllChildren() : await listLinkedChildren(user.uid)
    setLinkedChildren(childrenList)
    const stored = localStorage.getItem(activeChildStorageKey(user.uid))
    const next = childrenList.find(c => c.id === stored) || childrenList[0] || null
    setActiveChildIdState(next?.id || null)
    setActiveChild(next || null)
    if (next?.id) {
      localStorage.setItem(activeChildStorageKey(user.uid), next.id)
    }
  }, [role, user?.uid])

  const setActiveChildId = React.useCallback((id: string | null) => {
    setActiveChildIdState(id)
    if (user && role && role !== 'child') {
      if (id) localStorage.setItem(activeChildStorageKey(user.uid), id)
      else localStorage.removeItem(activeChildStorageKey(user.uid))
    }
    const found = linkedChildren.find(c => c.id === id) || null
    setActiveChild(found)
  }, [linkedChildren, role, user])

  React.useEffect(() => {
    let cancelled = false
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return
      if (!u) {
        setUser(null)
        setProfile(null)
        setRole(null)
        setLinkedChildren([])
        setActiveChild(null)
        setActiveChildIdState(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setUser(u)
      try {
        const prof = await ensureUserProfile(u, desiredDisplayNameRef.current)
        desiredDisplayNameRef.current = null
        if (cancelled) return
        setProfile(prof)
        setRole(prof.role)
        setLinkedParentName(null)
        if (prof.role === 'child') {
          const child: LinkedChild = { id: u.uid, displayName: prof.displayName, role: prof.role }
          setLinkedChildren([])
          setActiveChild(child)
          setActiveChildIdState(u.uid)
          // récupérer/générer le code de reprise
          await fetchRecoveryCode(u.uid, true)
          // load first parent displayName if exists
          const parentId = Array.isArray(prof.parents) ? prof.parents[0] : null
          if (parentId) {
            try {
              const parentSnap = await getDoc(doc(db, 'users', parentId))
              if (parentSnap.exists()) {
                setLinkedParentName((parentSnap.data() as any).displayName || parentId)
              }
            } catch {
              setLinkedParentName(parentId)
            }
          }
        } else {
          await refreshLinkedChildren()
          setRecoveryCode(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true; unsub() }
  }, [refreshLinkedChildren])

  const signInGoogle = async () => {
    await signInWithPopup(auth, providerGoogle)
  }

  const startAnonymousWithName = async (displayName: string) => {
    const trimmed = displayName.trim()
    if (!trimmed) throw new Error('Prénom requis')
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(childNameStorageKey, trimmed)
    }
    desiredDisplayNameRef.current = trimmed
    setLoading(true)
    await signInAnonymously(auth)
  }

  const signOutUser = async () => {
    await signOut(auth)
  }

  const generatePairingCode = async () => {
    if (!user || role !== 'child') throw new Error('Réservé aux comptes enfant')
    return createPairingCodeForChild(user.uid)
  }

  const redeemPairingCode = async (code: string) => {
    if (!user || (role !== 'parent' && role !== 'admin')) throw new Error('Réservé aux comptes parent/admin')
    const res = await redeemPairingCodeTx(code, user.uid)
    await refreshLinkedChildren()
    return res
  }

  const updateDisplayName = async (name: string) => {
    if (!user || !profile) throw new Error('Aucun utilisateur connecté')
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Prénom requis')
    await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true })
    if (profile.role === 'child' && typeof localStorage !== 'undefined') {
      localStorage.setItem(childNameStorageKey, trimmed)
    }
    setProfile(p => p ? { ...p, displayName: trimmed } : p)
    if (role === 'child') {
      setActiveChild({ id: user.uid, displayName: trimmed, role: 'child' })
      setActiveChildIdState(user.uid)
    }
    if (role === 'child' && linkedParentName) {
      // keep parent name; no change needed
    }
  }

  const resumeChildWithRecovery = async (code: string) => {
    await signInChildWithRecoveryCode(code)
  }

  const regenerateRecoveryCode = async () => {
    if (!user || role !== 'child') throw new Error('Réservé à l’enfant connecté')
    const newCode = await regenerateRecoveryCodeForChild(user)
    setRecoveryCode(newCode)
    await setDoc(doc(db, 'users', user.uid, 'meta', 'recovery'), { code: newCode }, { merge: true })
  }

  // Si un enfant est connecté et qu'aucun code n'est présent (ou invalide), tenter de régénérer
  React.useEffect(() => {
    if (role === 'child' && user?.uid && !recoveryCode) {
      fetchRecoveryCode(user.uid, true).catch(() => {})
    }
  }, [role, user?.uid, recoveryCode, fetchRecoveryCode])

  React.useEffect(() => {
    // si un parent sélectionne un enfant, on récupère son code de reprise pour l’afficher
    const fetchRecovery = async () => {
      if (!activeChild?.id) {
        setRecoveryCode(null)
        return
      }
      await fetchRecoveryCode(activeChild.id)
    }
    fetchRecovery()
  }, [activeChild?.id, fetchRecoveryCode])

  const unlinkChild = async (childId: string) => {
    if (!user || (role !== 'parent' && role !== 'admin')) throw new Error('Réservé aux comptes parent/admin')
    await unlinkChildFromParent(user.uid, childId)
    await refreshLinkedChildren()
  }

  return (
    <Ctx.Provider value={{
      user,
      profile,
      role,
      loading,
      linkedChildren,
      activeChildId,
      activeChild,
      signInGoogle,
      startAnonymousWithName,
      signOutUser,
      setActiveChildId,
      refreshLinkedChildren,
      generatePairingCode,
      redeemPairingCode,
      updateDisplayName,
      linkedParentName,
      resumeChildWithRecovery,
      recoveryCode,
      unlinkChild,
      refreshRecoveryCode: async (childId?: string | null, forceGenerate?: boolean) => fetchRecoveryCode(childId || activeChildId || null, forceGenerate),
      regenerateRecoveryCode,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useAuth doit être utilisé sous <AuthProvider>')
  return v
}
