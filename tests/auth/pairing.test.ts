import { describe, expect, it, beforeEach, vi } from 'vitest'
import * as firestore from 'firebase/firestore'
import { createPairingCodeForChild, ensurePairingAvailable, generatePairingCodeValue, normalizePairingCode, PairingError, redeemPairingCode } from '../../src/auth/pairing'
import { db } from '../../src/firebase'
const { Timestamp, doc, setDoc } = firestore as any
const __store = (firestore as any).__store
const __resetStore = (firestore as any).__resetStore

vi.mock('../../src/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => {
  const store = {
    pairingCodes: new Map<string, any>(),
    users: new Map<string, any>(),
    familyLinks: new Map<string, any>(),
  }
  class MockTimestamp {
    private date: Date
    constructor(d: Date) { this.date = d }
    static fromDate(d: Date) { return new MockTimestamp(d) }
    toDate() { return this.date }
  }
  const serverTimestamp = () => ({ __serverTimestamp: true })
  const arrayUnion = (value: any) => ({ __arrayUnion: value })
  const resolveMap = (col: string) => {
    if (col === 'pairingCodes') return store.pairingCodes
    if (col === 'users') return store.users
    if (col === 'familyLinks') return store.familyLinks
    throw new Error(`Unknown collection ${col}`)
  }
  const applyMerge = (prev: any, next: any) => {
    const merged: any = { ...prev }
    Object.entries(next || {}).forEach(([k, v]) => {
      if (v && (v as any).__arrayUnion !== undefined) {
        const base = Array.isArray(prev?.[k]) ? prev[k] : []
        merged[k] = Array.from(new Set([...base, (v as any).__arrayUnion]))
      } else if (v && (v as any).__serverTimestamp) {
        merged[k] = new Date()
      } else {
        merged[k] = v
      }
    })
    return merged
  }
  const docFn = (_db: any, col: string, id?: string) => ({ col, id: id || '' })
  const setDoc = (ref: any, data: any, opts?: any) => {
    const map = resolveMap(ref.col)
    const prev = map.get(ref.id) || {}
    const merged = opts?.merge ? applyMerge(prev, data) : data
    map.set(ref.id, merged)
  }
  const updateFn = (ref: any, data: any) => {
    const map = resolveMap(ref.col)
    const prev = map.get(ref.id) || {}
    map.set(ref.id, applyMerge(prev, data))
  }
  const getDoc = async (ref: any) => {
    const map = resolveMap(ref.col)
    return {
      exists: () => map.has(ref.id),
      data: () => map.get(ref.id),
    }
  }
  const runTransaction = async (_db: any, fn: any) => {
    const tx = {
      get: getDoc,
      update: updateFn,
      set: (ref: any, data: any, opts?: any) => setDoc(ref, data, opts),
    }
    return fn(tx)
  }
  const collection = (_db: any, name: string) => ({ col: name })
  const where = (field: string, _op: string, value: any) => ({ field, value })
  const query = (col: any, clause: any) => ({ col, clause })
  const getDocs = async (q: any) => {
    const map = resolveMap(q.col.col || q.col)
    const docs: any[] = []
    map.forEach((val, key) => {
      if (!q.clause || q.clause.field === 'parentId' && val.parentId === q.clause.value) {
        docs.push({ id: key, data: () => val })
      }
    })
    return { docs }
  }
  const resetStore = () => {
    store.pairingCodes.clear()
    store.users.clear()
    store.familyLinks.clear()
  }
  return {
    Timestamp: MockTimestamp,
    serverTimestamp,
    arrayUnion,
    doc: docFn,
    setDoc,
    getDoc,
    runTransaction,
    collection,
    query,
    where,
    getDocs,
    __store: store,
    __resetStore: resetStore,
  }
})

describe('pairing helpers', () => {
  it('normalizes and generates codes correctly', () => {
    expect(normalizePairingCode(' ab-12 ')).toBe('AB12')
    const code = generatePairingCodeValue(() => 0.5)
    expect(code).toHaveLength(8)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  it('rejects expired or used codes', () => {
    const now = new Date('2024-01-01T12:00:00Z')
    const valid: any = { code: 'AAAA1111', childUid: 'c1', expiresAt: Timestamp.fromDate(new Date(now.getTime() + 60000)), used: false }
    expect(() => ensurePairingAvailable(valid, now)).not.toThrow()
    const expired: any = { code: 'AAAA2222', childUid: 'c1', expiresAt: Timestamp.fromDate(new Date(now.getTime() - 1000)), used: false }
    expect(() => ensurePairingAvailable(expired, now)).toThrowError(PairingError)
    const used: any = { code: 'AAAA3333', childUid: 'c1', expiresAt: Timestamp.fromDate(new Date(now.getTime() + 60000)), used: true }
    expect(() => ensurePairingAvailable(used, now)).toThrowError(PairingError)
  })
})

describe('redeemPairingCode (in-memory firestore mock)', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('links a child once and prevents reuse', async () => {
    await setDoc(doc(db, 'users', 'child1'), { role: 'child', displayName: 'Kid' })
    const generated = await createPairingCodeForChild('child1', new Date('2024-01-01T10:00:00Z'))
    expect(__store.pairingCodes.size).toBe(1)

    const res = await redeemPairingCode(generated.code, 'parent1', new Date('2024-01-01T10:05:00Z'))
    expect(res.childUid).toBe('child1')
    expect(__store.familyLinks.has('parent1_child1')).toBe(true)

    await expect(redeemPairingCode(generated.code, 'parent1', new Date('2024-01-01T10:06:00Z')))
      .rejects.toBeInstanceOf(PairingError)
  })
})
