import React from 'react'
import { collection, getDocs, getDoc, query, where, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { fetchQuestionsForModeration, setQuestionStatus, updateQuestionContent, deleteQuestion, archiveQuestion, softDeleteQuestion } from '../data/questions'
import type { ModerationFilters } from '../data/questions'
import type { QualityStatus, QuestionV1 } from '../domain/questions/types'
import { useAuth } from '../state/useAuth'
import { TAG_CATALOG, getTagMeta } from '../taxonomy/tagCatalog'
import { loadNpcPriorityTags, saveNpcPriorityTags } from '../data/npcPriorities'
import { useLocation, useNavigate } from 'react-router-dom'
import { getReportCountForQuestion } from '../data/questionReports'

const STATUS_OPTIONS: QualityStatus[] = ['draft', 'reviewed', 'published', 'rejected', 'archived']

function statusLabel(status: QualityStatus) {
  if (status === 'draft') return 'Draft'
  if (status === 'reviewed') return 'Revu'
  if (status === 'published') return 'Publié'
  if (status === 'rejected') return 'Rejeté'
  return 'Archivé'
}

export function QuestionModerationPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [filters, setFilters] = React.useState<ModerationFilters & { includeDeleted?: boolean }>({ status: 'draft', includeDeleted: false })
  const [questions, setQuestions] = React.useState<QuestionV1[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [edit, setEdit] = React.useState<QuestionV1 | null>(null)
  const [actionNote, setActionNote] = React.useState<string>('')
  const [legacyTag, setLegacyTag] = React.useState<string>('')
  const [legacyStatus, setLegacyStatus] = React.useState<string>('')
  const isDevAdmin = import.meta.env.VITE_DEV_ADMIN === 'true'
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = React.useState(false)
  const [priorityTags, setPriorityTagsState] = React.useState<string[]>([])
  const [prioritySearch, setPrioritySearch] = React.useState<string>('')
  const [children, setChildren] = React.useState<Array<{ id: string, displayName: string }>>([])
  const [selectedChildPriority, setSelectedChildPriority] = React.useState<string>('default')
  const [reportCount, setReportCount] = React.useState<number | null>(null)
  const [reportCountLoading, setReportCountLoading] = React.useState(false)
  const focusQuestionIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const stateId = (location.state as any)?.focusQuestionId
    const queryId = new URLSearchParams(location.search).get('questionId')
    const targetId = stateId || queryId
    if (targetId && targetId !== focusQuestionIdRef.current) {
      focusQuestionIdRef.current = targetId
      setFilters(f => ({ ...f, status: undefined, includeDeleted: true }))
      setSelectedId(targetId)
    }
  }, [location])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      let res = await fetchQuestionsForModeration(filters)
      if (focusQuestionIdRef.current && !res.find(q => q.id === focusQuestionIdRef.current)) {
        try {
          const snap = await getDoc(doc(db, 'questions', focusQuestionIdRef.current))
          if (snap.exists()) {
            const data = { id: snap.id, ...(snap.data() as any) } as QuestionV1
            res = [data, ...res]
          }
        } catch (e) {
          console.warn('focus question fetch failed', e)
        }
      }
      setQuestions(res)
      setSelectedIds((prev) => {
        const next = new Set<string>()
        res.forEach(q => { if (prev.has(q.id)) next.add(q.id) })
        return next
      })
      if (selectedId) {
        const found = res.find(q => q.id === selectedId)
        if (found) setEdit(found)
        setSelectedIds(prev => {
          const next = new Set<string>()
          res.forEach(q => {
            if (prev.has(q.id) || q.id === selectedId) next.add(q.id)
          })
          return next
        })
      }
    } finally {
      setLoading(false)
    }
  }, [filters, selectedId])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'child')))
        const kids = snap.docs.map(d => ({ id: d.id, displayName: (d.data() as any).displayName || d.id }))
        setChildren(kids)
      } catch {
        setChildren([])
      }
    })()
    // charger priorités par défaut si pas d'enfant sélectionné
    ;(async () => {
      const tags = await loadNpcPriorityTags(null)
      setPriorityTagsState(tags)
    })()
  }, [])

  React.useEffect(() => {
    ;(async () => {
      const tags = await loadNpcPriorityTags(selectedChildPriority === 'default' ? null : selectedChildPriority)
      setPriorityTagsState(tags)
    })()
  }, [selectedChildPriority])

  React.useEffect(() => {
    setReportCount(null)
  }, [selectedId])

  const selectQuestion = (q: QuestionV1) => {
    setSelectedId(q.id)
    setEdit(q)
    setActionNote('')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelectedIds(new Set(questions.map(q => q.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const onField = (key: keyof QuestionV1, value: any) => {
    if (!edit) return
    setEdit({ ...edit, [key]: value })
  }

  const fetchReportCount = async () => {
    if (!edit) return
    setReportCountLoading(true)
    try {
      const count = await getReportCountForQuestion(edit.id)
      setReportCount(count)
    } catch (e: any) {
      alert(e?.message || 'Impossible de charger les reports.')
    } finally {
      setReportCountLoading(false)
    }
  }

  const onSave = async () => {
    if (!edit) return
    await updateQuestionContent(edit.id, {
      statement: edit.statement,
      choices: edit.choices ?? null,
      answer: edit.answer,
      explanation: edit.explanation,
      commonMistake: edit.commonMistake,
      difficulty: edit.difficulty,
      secondaryTags: edit.secondaryTags,
      metaTags: edit.metaTags,
      blockId: edit.blockId,
      primaryTag: edit.primaryTag,
      updatedBy: user?.uid,
      note: actionNote,
    })
    setActionNote('')
    await load()
  }

  const changeStatus = async (status: QualityStatus, opts?: { requireNote?: boolean }) => {
    if (!edit) return
    if (opts?.requireNote && !actionNote.trim()) {
      alert('Une note est requise pour cette action.')
      return
    }
    try {
      await setQuestionStatus(edit.id, status, {
        reviewerId: user?.uid || undefined,
        notes: actionNote || undefined,
      })
      setActionNote('')
      await load()
    } catch (e: any) {
      alert(e?.message || 'Impossible de changer le statut.')
    }
  }

  const onDelete = async () => {
    if (!edit) return
    if (!window.confirm('Supprimer (soft delete) cette question ?')) return
    await softDeleteQuestion(edit.id, { by: user?.uid || undefined, notes: actionNote || undefined })
    setActionNote('')
    await load()
  }

  const onHardDelete = async () => {
    if (!isDevAdmin || !edit) return
    if (!window.confirm('Hard delete définitif (DEV uniquement) ?')) return
    await deleteQuestion(edit.id)
    setSelectedId(null)
    setEdit(null)
    await load()
  }

  const onArchive = async () => {
    if (!edit) return
    if (!window.confirm('Archiver cette question ?')) return
    await archiveQuestion(edit.id, { by: user?.uid || undefined, notes: actionNote || undefined })
    setActionNote('')
    await load()
  }

  const bulkSoftDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Supprimer (soft) ${selectedIds.size} question(s) ?`)) return
    setBulkLoading(true)
    try {
      for (const id of Array.from(selectedIds)) {
        try {
          await softDeleteQuestion(id, { by: user?.uid || undefined, notes: actionNote || undefined })
        } catch (e: any) {
          console.warn(`Échec delete sur ${id}:`, e?.message || e)
        }
      }
      setActionNote('')
      await load()
    } finally {
      setBulkLoading(false)
    }
  }

  const bulkChangeStatus = async (status: QualityStatus, opts?: { requireNote?: boolean }) => {
    if (selectedIds.size === 0) return
    if (opts?.requireNote && !actionNote.trim()) {
      alert('Une note est requise pour cette action.')
      return
    }
    setBulkLoading(true)
    try {
      for (const id of Array.from(selectedIds)) {
        try {
          await setQuestionStatus(id, status, {
            reviewerId: user?.uid || undefined,
            notes: actionNote || undefined,
          })
        } catch (e: any) {
          console.warn(`Échec sur ${id}:`, e?.message || e)
        }
      }
      setActionNote('')
      await load()
    } finally {
      setBulkLoading(false)
    }
  }

  const cleanupLegacyByTag = async () => {
    if (!legacyTag.trim()) return
    if (!window.confirm(`Supprimer les anciennes questions (collection exercises) avec le tag ${legacyTag} ?`)) return
    setLegacyStatus('Nettoyage en cours…')
    const snap = await getDocs(query(collection(db, 'exercises'), where('tags', 'array-contains', legacyTag.trim())))
    if (!snap.size) {
      setLegacyStatus('Aucune question legacy trouvée.')
      return
    }
    const batch = writeBatch(db)
    snap.docs.forEach(docSnap => batch.delete(docSnap.ref))
    await batch.commit()
    setLegacyStatus(`Supprimé ${snap.size} questions legacy.`)
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Modération questions</h2>
        <div className="row" style={{ gap: 8, flexWrap:'wrap' }}>
          <label className="small">Statut
            <select className="input" value={filters.status || ''} onChange={(e) => {
              const val = e.target.value as QualityStatus | ''
              setFilters(f => ({ ...f, status: val || undefined }))
            }}>
              <option value="">Tous</option>
              {STATUS_OPTIONS.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </select>
          </label>
          <label className="small">Tag
            <input className="input" value={filters.primaryTag || ''} onChange={(e) => setFilters(f => ({ ...f, primaryTag: e.target.value || undefined }))} placeholder="primaryTag" />
          </label>
          <label className="small">Bloc
            <input className="input" value={filters.blockId || ''} onChange={(e) => setFilters(f => ({ ...f, blockId: e.target.value || undefined }))} placeholder="blockId" />
          </label>
          <label className="small">Set ID
            <input className="input" value={filters.setId || ''} onChange={(e) => setFilters(f => ({ ...f, setId: e.target.value || undefined }))} placeholder="setId" />
          </label>
          <label className="small">Difficulté
            <input className="input" type="number" min={1} max={5} value={filters.difficulty || ''} onChange={(e) => setFilters(f => ({ ...f, difficulty: e.target.value ? Number(e.target.value) : undefined }))} />
          </label>
          <label className="small">Recherche
            <input className="input" value={filters.text || ''} onChange={(e) => setFilters(f => ({ ...f, text: e.target.value || undefined }))} placeholder="statement/answer" />
          </label>
          <label className="small row" style={{ alignItems:'center', gap:6, marginTop:4 }}>
            <input type="checkbox" checked={!!filters.includeDeleted} onChange={(e) => setFilters(f => ({ ...f, includeDeleted: e.target.checked }))} />
            <span>Afficher supprimées</span>
          </label>
          <button className="btn secondary" onClick={load} disabled={loading}>Recharger</button>
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          {loading ? 'Chargement…' : `${questions.length} questions`} · sélection : {selectedIds.size}
        </div>
        <div className="card" style={{ marginTop:10 }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700 }}>Priorités PNJ</div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>Ordre de priorité local pour les missions PNJ (par enfant).</div>
            </div>
            <div className="row" style={{ gap:6 }}>
              <button className="btn secondary" onClick={() => setPriorityTagsState(Object.keys(TAG_CATALOG))}>Tout sélectionner</button>
              <button className="btn secondary" onClick={() => setPriorityTagsState([])}>Vider</button>
              <button
                className="btn secondary"
                disabled={selectedChildPriority === 'default'}
                onClick={async () => {
                  if (selectedChildPriority === 'default') return
                  await saveNpcPriorityTags(selectedChildPriority, priorityTags)
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
          <div className="row" style={{ gap:8, marginTop:8, flexWrap:'wrap' }}>
            <label className="small">Enfant cible
              <select className="input" value={selectedChildPriority} onChange={(e) => setSelectedChildPriority(e.target.value)}>
                <option value="default">Tous (défaut local)</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
              </select>
            </label>
          </div>
          <label className="small" style={{ display:'block', marginTop:8 }}>
            Recherche tag
            <input className="input" value={prioritySearch} onChange={(e) => setPrioritySearch(e.target.value)} placeholder="id ou label" />
          </label>
          <div className="grid" style={{ marginTop:8, maxHeight:220, overflowY:'auto' }}>
            {Object.keys(TAG_CATALOG).filter(id => {
              const meta = getTagMeta(id)
              const needle = prioritySearch.toLowerCase()
              return meta.id.toLowerCase().includes(needle) || meta.label.toLowerCase().includes(needle)
            }).map(id => {
              const meta = getTagMeta(id)
              const checked = priorityTags.includes(id)
              return (
                <label key={id} className="small row" style={{ gap:6, alignItems:'center' }}>
                  <input type="checkbox" checked={checked} onChange={(e) => {
                    setPriorityTagsState(prev => {
                      const set = new Set(prev)
                      if (e.target.checked) set.add(id)
                      else set.delete(id)
                      return Array.from(set)
                    })
                  }} />
                  <span>{meta.label}</span>
                  <span className="small" style={{ color:'var(--mc-muted)' }}>{meta.id}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div className="row" style={{ gap:8, marginTop:6, flexWrap:'wrap' }}>
          <button className="btn secondary" onClick={selectAllVisible} disabled={loading}>Sélectionner tout</button>
          <button className="btn secondary" onClick={clearSelection} disabled={loading || selectedIds.size === 0}>Vider la sélection</button>
          <button className="btn secondary" disabled={selectedIds.size === 0 || bulkLoading} onClick={() => bulkChangeStatus('reviewed')}>Mark reviewed (sélection)</button>
          <button className="btn secondary" disabled={selectedIds.size === 0 || bulkLoading} onClick={() => bulkChangeStatus('published')}>Publier (sélection)</button>
          <button className="btn secondary" disabled={selectedIds.size === 0 || bulkLoading} onClick={() => bulkChangeStatus('rejected', { requireNote: true })}>Rejeter (sélection)</button>
          <button className="btn secondary" disabled={selectedIds.size === 0 || bulkLoading} onClick={bulkSoftDelete}>Delete (soft, sélection)</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1.4fr 1fr', gap: 12 }}>
        <div className="card" style={{ maxHeight:'70vh', overflow:'auto' }}>
          <div className="small" style={{ marginBottom:6 }}>Liste</div>
          {questions.length === 0 && <div className="small">Aucune question.</div>}
          {questions.map((q) => (
            <div
              key={q.id}
              className="pill"
              style={{
                padding:10,
                marginBottom:6,
                cursor:'pointer',
                border: selectedId === q.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
              }}
              onClick={() => selectQuestion(q)}
            >
              <div className="row" style={{ justifyContent:'space-between', gap:8 }}>
                <div className="row" style={{ alignItems:'flex-start', gap:8 }}>
                  <input type="checkbox" checked={selectedIds.has(q.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(q.id) }} />
                  <div>
                    <div style={{ fontWeight:700 }}>{q.statement?.slice(0, 80) || q.id}</div>
                    <div className="small">{q.primaryTag} · {q.blockId} · diff {q.difficulty}</div>
                  </div>
                </div>
                <span className="badge">{statusLabel(q.quality?.status || 'draft')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div className="small">Édition</div>
              <div style={{ fontWeight:900 }}>{edit?.id || 'Sélectionne une question'}</div>
            </div>
            {edit && <span className="badge">{statusLabel(edit.quality?.status || 'draft')}</span>}
          </div>
          {edit && (
            <div className="small" style={{ marginTop:4 }}>
              Reports : <strong>{reportCount !== null ? reportCount : '—'}</strong>
              <button
                className="btn secondary"
                style={{ marginLeft: 8, padding:'2px 8px', fontSize:'0.8rem' }}
                onClick={fetchReportCount}
                disabled={reportCountLoading}
              >
                {reportCountLoading ? '...' : 'Charger'}
              </button>
            </div>
          )}

          {edit ? (
            <>
              <label className="small" style={{ marginTop:10 }}>Enoncé
                <textarea className="input" value={edit.statement || ''} onChange={(e) => onField('statement', e.target.value)} />
              </label>
              {(edit.type === 'MCQ' || edit.type === 'TRUE_FALSE') && (
                <label className="small">Choix (1 par ligne)
                  <textarea className="input" value={(edit.choices || []).join('\n')} onChange={(e) => onField('choices', e.target.value.split('\n').filter(x => x.trim().length))} />
                </label>
              )}
              <label className="small">Réponse attendue
                <input className="input" value={edit.answer || ''} onChange={(e) => onField('answer', e.target.value)} />
              </label>
              <label className="small">Explication
                <textarea className="input" value={edit.explanation || ''} onChange={(e) => onField('explanation', e.target.value)} />
              </label>
              <label className="small">Piège fréquent
                <textarea className="input" value={edit.commonMistake || ''} onChange={(e) => onField('commonMistake', e.target.value)} />
              </label>
              <div className="row" style={{ gap: 8 }}>
                <label className="small">Difficulté
                  <input className="input" type="number" min={1} max={5} value={edit.difficulty || 1} onChange={(e) => onField('difficulty', Number(e.target.value))} />
                </label>
                <label className="small">PrimaryTag
                  <input className="input" value={edit.primaryTag || ''} onChange={(e) => onField('primaryTag', e.target.value)} />
                </label>
                <label className="small">BlockId
                  <input className="input" value={edit.blockId || ''} onChange={(e) => onField('blockId', e.target.value)} />
                </label>
              </div>
              <label className="small">Secondary tags (comma)
                <input className="input" value={(edit.secondaryTags || []).join(',')} onChange={(e) => onField('secondaryTags', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} />
              </label>
              <label className="small">Meta tags (meta_x, comma)
                <input className="input" value={(edit.metaTags || []).join(',')} onChange={(e) => onField('metaTags', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} />
              </label>

              <label className="small">Note modération
                <textarea className="input" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Ex: corrigé l’énoncé, prêt pour review" />
              </label>

              <div className="row" style={{ gap: 8, flexWrap:'wrap', marginTop:8 }}>
                <button className="btn secondary" onClick={onSave}>Save</button>
                <button className="btn secondary" onClick={() => nav(`/admin/reports?questionId=${edit.id}`)}>Voir reports</button>
                <button className="btn secondary" onClick={() => changeStatus('reviewed')}>Mark reviewed</button>
                <button className="btn secondary" onClick={() => changeStatus('published', { requireNote: false })}>Publish</button>
                <button className="btn secondary" onClick={() => changeStatus('rejected', { requireNote: true })}>Reject</button>
                <button className="btn secondary" onClick={onArchive}>Archive</button>
                <button className="btn secondary" onClick={onDelete}>Delete (soft)</button>
                {isDevAdmin && <button className="btn secondary" onClick={onHardDelete}>Hard delete (DEV)</button>}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight:700 }}>Historique</div>
                <div className="small">
                  {(edit.quality?.history || []).length === 0 && 'Aucun historique.'}
                  {(edit.quality?.history || []).slice().reverse().map((h, idx) => (
                    <div key={idx} style={{ borderBottom:'1px solid rgba(255,255,255,0.1)', padding:'4px 0' }}>
                      <div>{h.action} — {h.status || ''} — {h.by}</div>
                      <div className="small" style={{ opacity:0.8 }}>{(h.at as any) || ''} {h.notes && `· ${h.notes}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="small">Sélectionne une question pour éditer.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop:0 }}>Nettoyage ancien format</h3>
        <p className="small">
          Supprime les questions legacy (collection <code>exercises</code>) par tag pour éviter les doublons avec le nouveau flux.
        </p>
        <div className="row" style={{ gap: 8, alignItems:'center' }}>
          <input className="input" placeholder="ex: fr_grammaire_phrase_simple" value={legacyTag} onChange={(e) => setLegacyTag(e.target.value)} />
          <button className="btn secondary" onClick={cleanupLegacyByTag}>Supprimer legacy</button>
          {legacyStatus && <span className="small">{legacyStatus}</span>}
        </div>
      </div>
    </div>
  )
}
