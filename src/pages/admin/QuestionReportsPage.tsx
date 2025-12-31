import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getQuestionAttemptStats,
  getReportCountForQuestion,
  groupTopReportedQuestions,
  listQuestionReports,
  updateReportStatus,
  type QuestionReport,
  type QuestionReportStatus,
  type ReportReason,
} from '../../data/questionReports'
import { useAuth } from '../../state/useAuth'

type Filters = {
  status: QuestionReportStatus | ''
  reason: ReportReason | ''
  primaryTag: string
  blockId: string
  questionId: string
  dateRange: '7' | '30' | 'all'
}

const REASONS: Array<{ value: ReportReason, label: string }> = [
  { value: 'wrong_answer', label: 'Mauvaise correction' },
  { value: 'ambiguous', label: 'Énoncé ambigu' },
  { value: 'typo', label: 'Faute ou typo' },
  { value: 'too_hard', label: 'Trop difficile' },
  { value: 'off_topic', label: 'Hors sujet' },
  { value: 'other', label: 'Autre' },
]

export function QuestionReportsPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = React.useState<Filters>({
    status: 'open',
    reason: '',
    primaryTag: '',
    blockId: '',
    questionId: searchParams.get('questionId') || '',
    dateRange: '7',
  })
  const [reports, setReports] = React.useState<QuestionReport[]>([])
  const [loading, setLoading] = React.useState(false)
  const [actionNote, setActionNote] = React.useState('')
  const [statusLoading, setStatusLoading] = React.useState<string | null>(null)
  const [focusQuestionId, setFocusQuestionId] = React.useState<string | null>(searchParams.get('questionId'))
  const [statsLoading, setStatsLoading] = React.useState(false)
  const [questionStats, setQuestionStats] = React.useState<{ reports: number, totalAttempts: number, wrongAttempts: number, wrongRate: number } | null>(null)
  const [errorMsg, setErrorMsg] = React.useState('')

  const reload = React.useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await listQuestionReports({
        sinceDays: filters.dateRange === 'all' ? undefined : Number(filters.dateRange),
      })
      setReports(data)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Impossible de charger les reports.')
    } finally {
      setLoading(false)
    }
  }, [filters.dateRange])

  const refreshStats = React.useCallback(async (qid: string) => {
    setStatsLoading(true)
    try {
      const [reportsCount, attemptStats] = await Promise.all([
        getReportCountForQuestion(qid),
        getQuestionAttemptStats(qid),
      ])
      setQuestionStats({
        reports: reportsCount,
        totalAttempts: attemptStats.total,
        wrongAttempts: attemptStats.wrong,
        wrongRate: attemptStats.wrongRate,
      })
    } catch (e: any) {
      setQuestionStats(null)
      setErrorMsg(e?.message || 'Stats indisponibles.')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  React.useEffect(() => {
    const next = new URLSearchParams()
    if (filters.questionId) next.set('questionId', filters.questionId)
    setSearchParams(next, { replace: true })
  }, [filters.questionId, setSearchParams])

  React.useEffect(() => {
    if (focusQuestionId) {
      refreshStats(focusQuestionId)
    } else {
      setQuestionStats(null)
    }
  }, [focusQuestionId, refreshStats])

  const filteredReports = React.useMemo(() => {
    return reports.filter(r => {
      if (filters.status && r.status !== filters.status) return false
      if (filters.reason && r.reason !== filters.reason) return false
      if (filters.questionId && r.questionId !== filters.questionId) return false
      if (filters.primaryTag && r.context?.primaryTag !== filters.primaryTag) return false
      if (filters.blockId && r.context?.blockId !== filters.blockId) return false
      return true
    })
  }, [filters.blockId, filters.primaryTag, filters.questionId, filters.reason, filters.status, reports])

  const topReported = React.useMemo(() => groupTopReportedQuestions(reports, 20), [reports])

  const setFilter = (patch: Partial<Filters>) => setFilters(prev => ({ ...prev, ...patch }))

  const onStatusChange = async (report: QuestionReport, status: QuestionReportStatus) => {
    setStatusLoading(report.id)
    try {
      await updateReportStatus(report.id, status, { notes: actionNote || undefined, resolvedBy: status === 'resolved' ? (user?.uid || null) : undefined })
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status, admin: { ...(r.admin || {}), notes: actionNote || r.admin?.notes, resolvedBy: status === 'resolved' ? (user?.uid || null) : r.admin?.resolvedBy, resolvedAt: status === 'resolved' ? new Date() : r.admin?.resolvedAt } } : r))
      if (status === 'resolved' || status === 'triaged') setActionNote('')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Mise à jour impossible.')
    } finally {
      setStatusLoading(null)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Reports questions</h2>
        <div className="row" style={{ gap: 8, flexWrap:'wrap' }}>
          <label className="small">Statut
            <select className="input" value={filters.status} onChange={(e) => setFilter({ status: e.target.value as Filters['status'] })}>
              <option value="">Tous</option>
              <option value="open">Open</option>
              <option value="triaged">Triaged</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="small">Raison
            <select className="input" value={filters.reason} onChange={(e) => setFilter({ reason: e.target.value as Filters['reason'] })}>
              <option value="">Toutes</option>
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="small">Tag
            <input className="input" value={filters.primaryTag} onChange={(e) => setFilter({ primaryTag: e.target.value })} placeholder="primaryTag" />
          </label>
          <label className="small">Bloc
            <input className="input" value={filters.blockId} onChange={(e) => setFilter({ blockId: e.target.value })} placeholder="blockId" />
          </label>
          <label className="small">QuestionId
            <input className="input" value={filters.questionId} onChange={(e) => {
              const val = e.target.value
              setFilter({ questionId: val })
              setFocusQuestionId(val || null)
            }} placeholder="id" />
          </label>
          <label className="small">Période
            <select className="input" value={filters.dateRange} onChange={(e) => setFilter({ dateRange: e.target.value as Filters['dateRange'] })}>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="all">Tout</option>
            </select>
          </label>
          <button className="btn secondary" onClick={reload} disabled={loading}>Recharger</button>
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          {loading ? 'Chargement…' : `${filteredReports.length} reports (${reports.length} chargés)`}
        </div>
        {errorMsg && <div className="small" style={{ color:'#ff5a6f', marginTop: 6 }}>{errorMsg}</div>}
      </div>

      <div className="grid" style={{ gridTemplateColumns:'2fr 1fr', gap: 12 }}>
        <div className="card" style={{ maxHeight:'60vh', overflowY:'auto' }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700 }}>Liste</div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>Clique pour focus stats / modération.</div>
            </div>
            <label className="small" style={{ display:'flex', flexDirection:'column' }}>
              Note admin
              <textarea className="input" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Notes pour triage/résolution" />
            </label>
          </div>
          {filteredReports.length === 0 && <div className="small" style={{ marginTop: 8 }}>Aucun report.</div>}
          {filteredReports.map((r) => {
            const createdAt = typeof r.createdAt?.toDate === 'function' ? r.createdAt.toDate().toLocaleString() : ''
            return (
              <div key={r.id} className="pill" style={{ marginTop: 8, borderColor: focusQuestionId === r.questionId ? 'var(--accent)' : undefined }}>
                <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start', gap: 8 }}>
                  <div>
                    <div className="small" style={{ color:'var(--mc-muted)' }}>{createdAt}</div>
                    <div style={{ fontWeight:700 }}>QID {r.questionId}</div>
                    <div className="small">{r.reason} • {r.status}</div>
                    <div className="small" style={{ color:'var(--mc-muted)', maxWidth: 460, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {r.message || '—'}
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>
                      {r.context?.primaryTag && <span className="badge">tag {r.context.primaryTag}</span>} {' '}
                      {r.context?.blockId && <span className="badge">bloc {r.context.blockId}</span>} {' '}
                      {r.context?.setId && <span className="badge">set {r.context.setId}</span>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap:'wrap' }}>
                    <button className="btn secondary" onClick={() => { setFocusQuestionId(r.questionId); setFilter({ questionId: r.questionId }) }}>Stats</button>
                    <button className="btn secondary" onClick={() => nav('/admin/questions', { state: { focusQuestionId: r.questionId } })}>Ouvrir question</button>
                    <button className="btn secondary" onClick={() => onStatusChange(r, 'triaged')} disabled={statusLoading === r.id}>Trier</button>
                    <button className="btn secondary" onClick={() => onStatusChange(r, 'resolved')} disabled={statusLoading === r.id}>Résoudre</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div className="small" style={{ color:'var(--mc-muted)' }}>Stats question</div>
              <div style={{ fontWeight:900 }}>{focusQuestionId || '—'}</div>
            </div>
            <button className="btn secondary" onClick={() => focusQuestionId && refreshStats(focusQuestionId)} disabled={!focusQuestionId || statsLoading}>Rafraîchir</button>
          </div>
          {statsLoading && <div className="small" style={{ marginTop: 8 }}>Chargement…</div>}
          {questionStats && !statsLoading && (
            <div style={{ marginTop: 8 }}>
              <div className="small">Reports : <strong>{questionStats.reports}</strong></div>
              <div className="small">Attempts : <strong>{questionStats.totalAttempts}</strong></div>
              <div className="small">Wrong : <strong>{questionStats.wrongAttempts}</strong></div>
              <div className="small">Wrong rate : <strong>{questionStats.wrongRate}%</strong></div>
            </div>
          )}
          <hr />
          <div>
            <div style={{ fontWeight:700 }}>Top reports (client, derniers {reports.length})</div>
            {topReported.length === 0 && <div className="small">Aucun report.</div>}
            {topReported.map(row => (
              <div key={row.questionId} className="row" style={{ justifyContent:'space-between', alignItems:'center', marginTop: 6 }}>
                <div>
                  <div style={{ fontWeight:700 }}>{row.questionId}</div>
                  <div className="small" style={{ color:'var(--mc-muted)' }}>reports: {row.count}</div>
                </div>
                <button className="btn secondary" onClick={() => { setFocusQuestionId(row.questionId); setFilter({ questionId: row.questionId }) }}>Voir</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
