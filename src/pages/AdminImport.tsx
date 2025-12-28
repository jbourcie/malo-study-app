import React from 'react'
import { importQuestionPackClient } from '../data/questions'
import { validateQuestionPack, type QuestionPackV1 } from '../domain/questions/types'

type DropState = 'idle' | 'dragging'

export function AdminImportPage() {
  const [status, setStatus] = React.useState<string>('')
  const [errors, setErrors] = React.useState<string[]>([])
  const [warnings, setWarnings] = React.useState<string[]>([])
  const [report, setReport] = React.useState<{
    packImported: boolean
    questions: { created: number; updated: number; ignored: number }
  } | null>(null)
  const [pack, setPack] = React.useState<QuestionPackV1 | null>(null)
  const [dropState, setDropState] = React.useState<DropState>('idle')
  const [dryRun, setDryRun] = React.useState<boolean>(false)
  const [isImporting, setIsImporting] = React.useState<boolean>(false)

  const readFile = async (file: File | null) => {
    if (!file) return
    setStatus('Lecture du fichier…')
    setErrors([])
    const text = await file.text()
    let parsed: QuestionPackV1
    try {
      parsed = JSON.parse(text)
    } catch {
      setStatus('❌ JSON invalide')
      setPack(null)
      return
    }
    const validation = validateQuestionPack(parsed)
    if (!validation.ok) {
      setStatus('❌ Erreurs de validation')
      setErrors(validation.errors)
      setWarnings(validation.warnings || [])
      setReport(null)
      setPack(null)
      return
    }
    setPack(parsed)
    const warns = validation.warnings || []
    setWarnings(warns)
    setReport(null)
    const warningPart = warns.length ? ` · ${warns.length} avertissement(s)` : ''
    setStatus(`✅ Pack prêt : ${parsed.pack.setId} (${parsed.questions.length} questions${warningPart})`)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDropState('idle')
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  const onImport = async () => {
    if (!pack || isImporting) {
      return
    }
    setIsImporting(true)
    setStatus(dryRun ? 'Validation (dry-run)…' : 'Import en cours…')
    try {
      const res = await importQuestionPackClient(pack, { dryRun })
      // Log technique pour suivre le rapport retourné
      const fallbackReport = res?.report || {
        packImported: res?.ok && !dryRun,
        questions: {
          created: res?.ok ? pack.questions.length : 0,
          updated: 0,
          ignored: res?.ok ? 0 : pack.questions.length,
        },
      }
      const warns = res?.warnings || []
      if (!res?.ok) {
        const warningPart = warns.length ? ` · ${warns.length} avertissement(s)` : ''
        setStatus(`❌ Erreurs détectées${warningPart}`)
        setErrors(res?.errors || ['Import échoué (réponse vide)'])
        setWarnings(warns)
        setReport(fallbackReport)
        return
      }
      const warningPart = warns.length ? ` avec ${warns.length} avertissement(s)` : ''
      const counts = ` · créées ${fallbackReport.questions.created} · mises à jour ${fallbackReport.questions.updated} · ignorées ${fallbackReport.questions.ignored}`
      setStatus(dryRun ? `✅ Validation OK (aucune écriture${warningPart}${counts})` : `✅ Import terminé${warningPart}${counts}`)
      setErrors([])
      setWarnings(warns)
      setReport(fallbackReport)
    } catch (e: any) {
      setStatus('❌ Erreur inattendue pendant l’import')
      setErrors([e?.message || String(e)])
      setWarnings([])
      setReport({
        packImported: false,
        questions: { created: 0, updated: 0, ignored: pack.questions.length },
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop:0 }}>Import de pack de questions</h2>
        <p className="small">
          Glisse ton fichier JSON (QuestionPackV1). Les questions sont importées en <strong>draft</strong> dans Firestore (collections <code>questionPacks</code> et <code>questions</code>).
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDropState('dragging') }}
          onDragLeave={() => setDropState('idle')}
          onDrop={onDrop}
          style={{
            border: dropState === 'dragging' ? '2px solid var(--accent)' : '2px dashed rgba(255,255,255,0.3)',
            padding: 16,
            borderRadius: 8,
            marginBottom: 10,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div className="small">Glisse ton fichier ici ou sélectionne-le :</div>
          <input className="input" type="file" accept=".json,application/json" onChange={(e) => readFile(e.target.files?.[0] || null)} />
        </div>

        {pack && (
          <div className="pill" style={{ marginTop: 6 }}>
            Pack {pack.pack.setId} · {pack.pack.grade}/{pack.pack.lang} · {pack.questions.length} questions
          </div>
        )}

        <label style={{ display:'flex', gap:6, alignItems:'center', marginTop:10 }}>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          <span className="small">Dry-run (validation sans écrire)</span>
        </label>

        <button className="btn" style={{ marginTop: 10 }} onClick={onImport} disabled={!pack || isImporting}>
          {dryRun ? 'Valider le pack' : 'Importer le pack'}
        </button>

        {status && <p className="small" style={{ marginTop: 10 }}>{status}</p>}
        {warnings.length > 0 && (
          <div className="card" style={{ marginTop: 10, background:'rgba(255,196,0,0.05)', border:'1px solid rgba(255,196,0,0.4)' }}>
            <div style={{ fontWeight: 700 }}>Avertissements</div>
            <ul className="small">
              {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          </div>
        )}
        {report && (
          <div className="card" style={{ marginTop: 10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Rapport d’import</div>
            <ul className="small">
              <li>Pack importé : {report.packImported ? 'oui' : 'non'} {dryRun ? '(dry-run)' : ''}</li>
              <li>Questions créées : {report.questions.created}</li>
              <li>Questions mises à jour : {report.questions.updated}</li>
              <li>Questions ignorées : {report.questions.ignored}</li>
              {warnings.length > 0 ? <li>Avertissements : {warnings.length}</li> : null}
              {errors.length > 0 ? <li>Erreurs : {errors.length}</li> : null}
            </ul>
          </div>
        )}
        {errors.length > 0 && (
          <div className="card" style={{ marginTop: 10, background:'rgba(255,0,0,0.05)', border:'1px solid rgba(255,0,0,0.2)' }}>
            <div style={{ fontWeight: 700 }}>Erreurs</div>
            <ul className="small">
              {errors.map((err, idx) => <li key={idx}>{err}</li>)}
            </ul>
          </div>
        )}

        <hr style={{ marginTop: 16, marginBottom: 10 }} />
        <p className="small">
          Rappel : <code>quality.status</code> est forcé à <code>draft</code> à l’import. Tu publies ensuite dans l’onglet « Modération questions ».
        </p>
      </div>
    </div>
  )
}
