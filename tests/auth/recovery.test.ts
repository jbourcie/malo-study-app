import { describe, expect, it, beforeEach, vi } from 'vitest'
import * as firestore from 'firebase/firestore'
import * as auth from 'firebase/auth'
import { ensureRecoveryCodeForChild, regenerateRecoveryCodeForChild, signInChildWithRecoveryCode, validateRecoveryDoc } from '../../src/auth/recovery'
import { db, auth as appAuth } from '../../src/firebase'

const __store = (firestore as any).__store
const __resetStore = (firestore as any).__resetStore
const linkWithCredentialMock = (auth as any).__linkWithCredential
const signInWithEmailAndPasswordMock = (auth as any).__signInWithEmailAndPassword
const signInAnonymouslyMock = (auth as any).__signInAnonymously

vi.mock('../../src/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}))

vi.mock('firebase/auth', async () => {
  const __linkWithCredential = vi.fn()
  const __signInWithEmailAndPassword = vi.fn((_auth: any, email: string) => ({ user: { uid: email.replace('child-','').replace('@child.malocraft',''), providerData: [{ providerId: 'password' }] } }))
  const __signInAnonymously = vi.fn(() => Promise.resolve())
  const EmailAuthProvider = {
    credential: (email: string, password: string) => ({ email, password }),
  }
  return {
    EmailAuthProvider,
    linkWithCredential: (...args: any[]) => __linkWithCredential(...args),
    signInWithEmailAndPassword: (...args: any[]) => __signInWithEmailAndPassword(...args),
    signInAnonymously: (...args: any[]) => __signInAnonymously(...args),
    __linkWithCredential,
    __signInWithEmailAndPassword,
    __signInAnonymously,
  }
})

vi.mock('firebase/firestore', async () => {
  const store = new Map<string, any>()
  const pathKey = (ref: any) => ref.path
  const serverTimestamp = () => ({ __serverTimestamp: true })
  const mergeObj = (prev: any, next: any) => {
    const merged: any = { ...prev }
    Object.entries(next || {}).forEach(([k, v]) => {
      if ((v as any).__serverTimestamp) merged[k] = new Date()
      else merged[k] = v
    })
    return merged
  }
  const doc = (_db: any, col: string, id?: string, subcol?: string, subid?: string) => ({
    path: subcol && subid ? `${col}/${id}/${subcol}/${subid}` : `${col}/${id}`,
  })
  const getDoc = async (ref: any) => {
    const key = pathKey(ref)
    return {
      exists: () => store.has(key),
      data: () => store.get(key),
    }
  }
  const setDoc = async (ref: any, data: any, opts?: any) => {
    const key = pathKey(ref)
    const prev = store.get(key) || {}
    const merged = opts?.merge ? mergeObj(prev, data) : data
    store.set(key, merged)
  }
  const __resetStore = () => store.clear()
  return {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    __store: store,
    __resetStore,
  }
})

describe('recovery codes', () => {
  beforeEach(() => {
    __resetStore()
    linkWithCredentialMock.mockClear()
    signInWithEmailAndPasswordMock.mockClear()
    signInAnonymouslyMock.mockClear()
  })

  it('generates and stores a recovery code for a child', async () => {
    const fakeChild: any = { uid: 'child1' }
    const code = await ensureRecoveryCodeForChild(fakeChild)
    expect(code).toHaveLength(20)
    expect(__store.has(`childRecoveryCodes/${code}`)).toBe(true)
    expect(__store.get(`childRecoveryCodes/${code}`)?.childUid).toBe('child1')
    expect(__store.get(`users/child1/meta/recovery`)?.code).toBe(code)
    expect(linkWithCredentialMock).toHaveBeenCalledWith(fakeChild, { email: `child-child1@child.malocraft`, password: code })
  })

  it('reuses existing recovery code and does not relink', async () => {
    const fakeChild: any = { uid: 'child1' }
    const first = await ensureRecoveryCodeForChild(fakeChild)
    linkWithCredentialMock.mockClear()
    const second = await ensureRecoveryCodeForChild(fakeChild)
    expect(second).toBe(first)
    expect(linkWithCredentialMock).not.toHaveBeenCalled()
  })

  it('generates a new code when previous is revoked or expired', async () => {
    const fakeChild: any = { uid: 'child1' }
    const first = await ensureRecoveryCodeForChild(fakeChild)
    // Mark revoked
    const rec = __store.get(`childRecoveryCodes/${first}`)
    __store.set(`childRecoveryCodes/${first}`, { ...rec, revoked: true })
    const second = await ensureRecoveryCodeForChild(fakeChild)
    expect(second).not.toBe(first)
    const rec2 = __store.get(`childRecoveryCodes/${second}`)
    expect(rec2.revoked).not.toBe(true)

    // Expire and regenerate
    __store.set(`childRecoveryCodes/${second}`, { ...rec2, expiresAt: new Date(Date.now() - 1000) })
    const third = await ensureRecoveryCodeForChild(fakeChild)
    expect(third).not.toBe(second)
  })

  it('revokes previous code when regenerating explicitly', async () => {
    const fakeChild: any = { uid: 'child1' }
    const first = await ensureRecoveryCodeForChild(fakeChild)
    const second = await regenerateRecoveryCodeForChild(fakeChild)
    expect(second).not.toBe(first)
    expect(__store.get(`childRecoveryCodes/${first}`).revoked).toBe(true)
  })

  it('signs in with a recovery code and derived email', async () => {
    const fakeChild: any = { uid: 'child1' }
    const code = await ensureRecoveryCodeForChild(fakeChild)
    await signInChildWithRecoveryCode(code)
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(appAuth, `child-child1@child.malocraft`, code)
    expect(signInAnonymouslyMock).toHaveBeenCalled() // auth anonyme préalable si nécessaire
  })

  it('validateRecoveryDoc rejects revoked or expired codes', () => {
    const now = new Date()
    expect(() => validateRecoveryDoc({ revoked: true, expiresAt: new Date(now.getTime() + 1000) }, now)).toThrow()
    expect(() => validateRecoveryDoc({ revoked: false, expiresAt: new Date(now.getTime() - 1000) }, now)).toThrow()
  })
})
