import React from 'react'
import { importQuestionPackClient } from '../data/questions'
import { validateQuestionPack, type QuestionPackV1 } from '../domain/questions/types'

type DropState = 'idle' | 'dragging'

export function AdminImportPage() {
  const [status, setStatus] = React.useState<string>('')
  const [errors, setErrors] = React.useState<string[]>([])
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
      setPack(null)
      return
    }
    setPack(parsed)
    setStatus(`✅ Pack prêt : ${parsed.pack.setId} (${parsed.questions.length} questions)`)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDropState('idle')
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  const onImport = async () => {
    if (!pack || isImporting) return
    setIsImporting(true)
    setStatus(dryRun ? 'Validation (dry-run)…' : 'Import en cours…')
    const res = await importQuestionPackClient(pack, { dryRun })
    setIsImporting(false)
    if (!res.ok) {
      setStatus('❌ Erreurs détectées')
      setErrors(res.errors)
      return
    }
    setStatus(dryRun ? '✅ Validation OK (aucune écriture)' : '✅ Import terminé')
    setErrors([])
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
