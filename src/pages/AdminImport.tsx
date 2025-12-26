import React from 'react'
import { importPack } from '../data/firestore'
import type { PackJSON } from '../types'

export function AdminImportPage() {
  const [status, setStatus] = React.useState<string>('')

  const onFile = async (file: File | null) => {
    if (!file) return
    setStatus('Lecture du fichier…')
    const text = await file.text()
    let pack: PackJSON
    try {
      pack = JSON.parse(text)
    } catch {
      setStatus('❌ JSON invalide')
      return
    }
    if (!pack?.subjects?.length) {
      setStatus('❌ Format inattendu (subjects manquant)')
      return
    }
    setStatus('Import en cours…')
    await importPack(pack)
    setStatus('✅ Import terminé')
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop:0 }}>Import d’exercices (Parent)</h2>
        <p className="small">
          Importe un pack JSON (généré par moi) : matières → thèmes → exercices.
        </p>
        <input className="input" type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0] || null)} />
        {status && <p className="small" style={{ marginTop: 10 }}>{status}</p>}
        <hr />
        <p className="small">
          Conseil : commence par importer les packs “Français (grammaire + conjugaison)” et “Maths (fractions)”.
        </p>
      </div>
    </div>
  )
}
