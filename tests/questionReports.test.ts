import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildReportId, createQuestionReport, validateReportPayload } from '../src/data/questionReports'
import { runTransaction, setDoc } from 'firebase/firestore'

vi.mock('../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, ...segments: string[]) => ({ path: segments.join('/') })),
  serverTimestamp: vi.fn(() => 'ts'),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}))

describe('questionReports helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('buildReportId concatenates question and uid', () => {
    expect(buildReportId('q123', 'u456')).toBe('q123_u456')
  })

  it('validateReportPayload trims and keeps optional message', () => {
    const res = validateReportPayload('typo', '  hello  ')
    expect(res.reason).toBe('typo')
    expect(res.message).toBe('hello')
  })

  it('validateReportPayload rejects invalid reason', () => {
    expect(() => validateReportPayload('invalid' as any, 'x')).toThrow()
  })

  it('returns alreadyExists on duplicate creation', async () => {
    const mockedSetDoc = setDoc as unknown as vi.Mock
    mockedSetDoc.mockImplementation(async () => {
      const err: any = new Error('exists')
      err.code = 'permission-denied'
      throw err
    })
    const res = await createQuestionReport({
      questionId: 'q1',
      uid: 'u1',
      reason: 'wrong_answer',
      message: 'bad correction',
      context: {},
    })
    expect(res.alreadyExists).toBe(true)
    expect(res.created).toBe(false)
  })

  it('strips undefined context fields before write', async () => {
    const mockedSetDoc = setDoc as unknown as vi.Mock
    mockedSetDoc.mockResolvedValue(undefined)
    await createQuestionReport({
      questionId: 'q2',
      uid: 'u2',
      reason: 'typo',
      message: undefined,
      context: { setId: 's1', primaryTag: undefined, blockId: 'b1', grade: undefined },
    })
    const payload = mockedSetDoc.mock.calls[0][1]
    expect(payload.context).toEqual({ setId: 's1', blockId: 'b1' })
    expect(payload.message).toBeUndefined()
  })
})
