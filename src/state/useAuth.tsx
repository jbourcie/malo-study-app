import React from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, providerGoogle } from '../firebase'
import type { Role } from '../types'

type AuthState = {
  user: User | null
  role: Role | null
  loading: boolean
  signInGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const Ctx = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [role, setRole] = React.useState<Role | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setRole(null)
      if (!u) { setLoading(false); return }

      const ref = doc(db, 'users', u.uid)
      const snap = await getDoc(ref)

      // Par défaut: child. Après ta première connexion (toi), tu passes ton role en "parent" dans Firestore console.
      if (!snap.exists()) {
        await setDoc(ref, {
          displayName: u.displayName || 'Utilisateur',
          role: 'child',
          createdAt: serverTimestamp(),
        })
      }
      const snap2 = await getDoc(ref)
      setRole((snap2.data()?.role || 'child') as Role)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signInGoogle = async () => {
    await signInWithPopup(auth, providerGoogle)
  }
  const signOutUser = async () => {
    await signOut(auth)
  }

  return (
    <Ctx.Provider value={{ user, role, loading, signInGoogle, signOutUser }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useAuth doit être utilisé sous <AuthProvider>')
  return v
}
