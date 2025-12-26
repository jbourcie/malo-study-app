import React from 'react'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../state/useAuth'
import type { SubjectId } from '../types'
import type { TagProgress } from '../typesProgress'

const SUBJECTS: Array<{ id: SubjectId | 'all', label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'fr', label: 'Français' },
  { id: 'math', label: 'Maths' },
  { id: 'en', label: 'Anglais' },
  { id: 'es', label: 'Espagnol' },
  { id: 'hist', label: 'Histoire' },
]

function extractSubject(tagId: string | undefined): SubjectId | null {
  if (!tagId) return null
  const prefix = tagId.split('_')[0]
  if (prefix === 'fr' || prefix === 'math' || prefix === 'en' || prefix === 'es' || prefix === 'hist') return prefix
  return null
}

function computeLast7(t: TagProgress) {
  if (t.last7) return t.last7
  if (Array.isArray(t.last7Results)) {
    return {
      correct: t.last7Results.filter(Boolean).length,
      wrong: t.last7Results.filter(x => !x).length,
    }
  }
  return { correct: 0, wrong: 0 }
}

export function ProgressPage() {
  const { user, role } = useAuth()
  const [children, setChildren] = React.useState<Array<{ id: string, displayName: string }>>([])
  const [selectedChild, setSelectedChild] = React.useState<string>('')
  const [tags, setTags] = React.useState<Array<TagProgress & { id: string }>>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<SubjectId | 'all'>('fr')
  const [summary, setSummary] = React.useState<any | null>(null)
  const [selectedTag, setSelectedTag] = React.useState<string>('')
  const [tagItems, setTagItems] = React.useState<any[]>([])
  const [loadingTag, setLoadingTag] = React.useState(false)

  React.useEffect(() => {
    if (!user) return
    if (role === 'parent') {
      (async () => {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'child')))
        const kids = snap.docs.map(d => ({ id: d.id, displayName: d.data().displayName || 'Enfant' }))
        setChildren(kids)
        if (kids[0]) setSelectedChild(kids[0].id)
      })()
    } else {
      setSelectedChild(user.uid)
    }
  }, [user, role])

  const loadData = React.useCallback(async (uid: string) => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'users', uid, 'tagProgress'))
    const data = snap.docs.map(d => ({ id: d.id, tagId: d.id, ...(d.data() as TagProgress) }))
    setTags(data)
    const summarySnap = await getDocs(collection(db, 'users', uid, 'progressSummary'))
    const main = summarySnap.docs.find(d => d.id === 'main')
    setSummary(main?.data() || null)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!selectedChild) return
    loadData(selectedChild)
  }, [selectedChild, loadData])

  const loadTagDetails = async (tagId: string) => {
    if (!selectedChild) return
    setSelectedTag(tagId)
    setLoadingTag(true)
    const itemsSnap = await getDocs(query(
      collection(db, 'users', selectedChild, 'attemptItems'),
      where('tags', 'array-contains', tagId),
      orderBy('createdAt', 'desc'),
      limit(50)
    ))
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    // Fetch prompts for missing ones
    const prompts: Record<string, string> = {}
    await Promise.all(Array.from(new Set(items.map(i => i.exerciseId))).map(async (exId) => {
      const exSnap = await getDoc(doc(db, 'exercises', exId))
      if (exSnap.exists()) prompts[exId] = (exSnap.data() as any).prompt || exId
    }))
    const detailed = items.map(it => ({
      ...it,
      prompt: it.prompt || prompts[it.exerciseId] || it.exerciseId,
    }))
    setTagItems(detailed)
    setLoadingTag(false)
  }

  const filtered = tags
    .filter(t => selected === 'all' ? true : extractSubject(t.tagId) === selected)
    .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))
    .slice(0, 20)

  const downloadReport = () => {
    const rows = [
      ['tagId', 'mastery', 'bucket', 'attempts', 'correct', 'wrong', 'last7_correct', 'last7_wrong', 'nextDueDate']
    ]
    tags.forEach(t => {
      const last7 = computeLast7(t)
      rows.push([
        t.tagId || t.id,
        String(t.mastery ?? 0),
        t.bucket || '',
        String((t as any).attempts ?? 0),
        String(t.correctAnswers ?? 0),
        String(t.wrongAnswers ?? 0),
        String(last7.correct),
        String(last7.wrong),
        t.nextDueDate || ''
      ])
    })
    const csv = rows.map(r => r.map(x => `"${(x ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `progress-${selectedChild || 'user'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Progression par tag</h2>
        <div className="row" style={{ gap: 8, alignItems:'center' }}>
          {role === 'parent' && (
            <>
              <label className="small">Enfant</label>
              <select className="input" value={selectedChild} onChange={(e) => setSelectedChild(e.target.value)}>
                {children.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
              </select>
            </>
          )}
          <label className="small">Matière</label>
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value as SubjectId | 'all')}>
            {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn secondary" onClick={downloadReport} disabled={!tags.length}>Télécharger CSV</button>
        </div>
        {summary && (
          <div className="kpi" style={{ marginTop: 10 }}>
            <div className="pill">Réponses: <strong>{summary.totalAnswers || 0}</strong></div>
            <div className="pill">Taux: <strong>{summary.totalAnswers ? Math.round((summary.correctAnswers || 0) / summary.totalAnswers * 100) : 0}%</strong></div>
            <div className="pill">Tentatives: <strong>{summary.totalAttempts || 0}</strong></div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card">Chargement…</div>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Top 20 faibles</h3>
          {filtered.length === 0 ? (
            <div className="small">Aucun tag pour le moment.</div>
          ) : (
            <div className="grid">
              {filtered.map(tag => {
                const last7 = computeLast7(tag)
                return (
                  <button
                    key={tag.id}
                    className="pill"
                    style={{ justifyContent:'space-between', display:'flex', alignItems:'center', width:'100%', textAlign:'left', cursor:'pointer' }}
                    onClick={() => loadTagDetails(tag.tagId || tag.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{tag.tagId}</div>
                      <div className="small">
                        {tag.mastery ?? 0}/100 · {tag.bucket} · {last7.correct}/{last7.correct + last7.wrong} sur 7 · Prochaine: {tag.nextDueDate || '—'}
                      </div>
                      <div style={{ height: 8, background:'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 6, width:'100%' }}>
                        <div style={{ height: 8, borderRadius: 999, width: `${Math.min(100, Math.max(0, tag.mastery || 0))}%`, background: 'linear-gradient(90deg,#ff5a6f,#7aa2ff)' }} />
                      </div>
                      <div className="row" style={{ marginTop: 6, gap: 4 }}>
                        {(tag.last7Results || []).map((r, idx) => (
                          <span key={idx} style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: r ? '#2ecc71' : '#ff5a6f', opacity: 0.9
                          }} />
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selectedTag && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Détails du tag : {selectedTag}</h3>
          {loadingTag ? (
            <div className="small">Chargement…</div>
          ) : tagItems.length === 0 ? (
            <div className="small">Aucune question trouvée pour ce tag.</div>
          ) : (
            <div className="grid">
              {tagItems.map(item => (
                <div key={item.id} className="pill" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                  <div className="small">
                    {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ''} · Diff {item.difficulty} · {item.correct ? '✅' : '❌'}
                  </div>
                  <div style={{ fontWeight: 700 }}>{item.prompt}</div>
                  <div className="small">Réponse donnée : <strong>{item.answer ?? '—'}</strong></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
