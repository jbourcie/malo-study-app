import React from 'react'
import { getBlocksForBiome, getBlockDef } from '../../game/blockCatalog'
import { subjectToBiomeId, type BiomeId } from '../../game/biomeCatalog'
import { SUBJECT_LABEL_FR, getTagMeta, TAG_CATALOG, type SubjectId } from '../../taxonomy/tagCatalog'

type DifficultyProfile = 'balanced' | 'easy' | 'hard'
type MixProfile = 'standard' | 'mcq_only' | 'mcq_heavy' | 'with_error_spotting'
type LessonSource = 'from_block_reference' | 'manual_override'

const BIOMES: Array<SubjectId | 'all'> = ['all', 'fr', 'math', 'en', 'es', 'hist']

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function PackRequestBuilderPage() {
  const [subjectFilter, setSubjectFilter] = React.useState<SubjectId | 'all'>('fr')
  const [search, setSearch] = React.useState('')
  const [selectedBlockId, setSelectedBlockId] = React.useState<string>('')
  const [packSize, setPackSize] = React.useState<number>(120)
  const [difficultyProfile, setDifficultyProfile] = React.useState<DifficultyProfile>('balanced')
  const [mixProfile, setMixProfile] = React.useState<MixProfile>('standard')
  const [avoidFillBlankAmbiguous, setAvoidFillBlankAmbiguous] = React.useState<boolean>(true)
  const [includeLesson, setIncludeLesson] = React.useState<boolean>(true)
  const [lessonSource, setLessonSource] = React.useState<LessonSource>('from_block_reference')
  const [manualLessonMarkdown, setManualLessonMarkdown] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [copyStatus, setCopyStatus] = React.useState<string>('')

  const blocks = React.useMemo(() => {
    if (subjectFilter === 'all') {
      return Object.keys(TAG_CATALOG).map(tagId => getBlockDef(tagId))
    }
    const biomeId: BiomeId = subjectToBiomeId(subjectFilter as SubjectId)
    return getBlocksForBiome(biomeId)
  }, [subjectFilter])
  const filtered = blocks.filter(b => {
    const meta = getTagMeta(b.tagId)
    const needle = search.toLowerCase()
    return meta.id.toLowerCase().includes(needle) || meta.label.toLowerCase().includes(needle)
  })

  React.useEffect(() => {
    // auto select first block when biome changes
    if (filtered.length && !filtered.find(b => b.tagId === selectedBlockId)) {
      setSelectedBlockId(filtered[0].tagId)
    }
  }, [filtered, selectedBlockId])

  const selectedMeta = selectedBlockId ? getTagMeta(selectedBlockId) : null
  const subject = selectedMeta?.subject || (subjectFilter !== 'all' ? subjectFilter : 'fr')
  const worldBiomeId = subjectToBiomeId(subject as SubjectId)
  const lang = subject === 'en' ? 'en' : subject === 'es' ? 'es' : 'fr'

  const markdown = React.useMemo(() => {
    if (!selectedBlockId || !selectedMeta) return ''
    const lessonSourceLine = lessonSource === 'manual_override' ? 'manual_override' : 'from_block_reference'
    const lessonOverride = lessonSource === 'manual_override' && manualLessonMarkdown.trim().length
      ? `## lessonOverride\n${manualLessonMarkdown.trim()}\n`
      : ''
    return [
      '# Demande de génération de pack riche',
      '',
      'Tag (blockId / primaryTag) :',
      selectedBlockId,
      '',
      'Sujet (subject) :',
      subject,
      '',
      'WorldBiomeId (optionnel) :',
      worldBiomeId,
      '',
      'Niveau :',
      '5e',
      '',
      'Langue :',
      lang,
      '',
      'Nombre de questions :',
      String(packSize),
      '',
      'Profil difficulté :',
      difficultyProfile,
      '',
      'Profil mix :',
      mixProfile,
      '',
      'Règles globales :',
      '- Conformes à GENERATION_STRATEGY.md',
      '- Stratégie par thème issue de THEME_STRATEGIES.md',
      '- Import = status draft',
      `- Pas de texte à trou ambigüe : ${avoidFillBlankAmbiguous}`,
      `- Inclure lesson + ancres : ${includeLesson}`,
      '',
      'Leçon :',
      `- Source : ${lessonSourceLine}`,
      `- Référence : docs/question-generation/block-references/${subject}/${selectedBlockId}.md`,
      '',
      lessonOverride,
      'Notes :',
      notes || '',
      '',
    ].join('\n')
  }, [selectedBlockId, selectedMeta, subject, worldBiomeId, lang, packSize, difficultyProfile, mixProfile, avoidFillBlankAmbiguous, includeLesson, lessonSource, manualLessonMarkdown, notes])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopyStatus('Copié !')
      setTimeout(() => setCopyStatus(''), 1500)
    } catch {
      setCopyStatus('Impossible de copier')
      setTimeout(() => setCopyStatus(''), 2000)
    }
  }

  const onDownload = () => {
    const filename = `pack_request_${selectedBlockId || 'block'}_${todayYmd()}.md`
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop:0 }}>Générer un brief de pack</h2>
        <div className="small" style={{ marginBottom:8 }}>
          Les règles pédagogiques sont définies dans <code>GENERATION_STRATEGY.md</code> et <code>THEME_STRATEGIES.md</code>.
        </div>
        <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
          <label className="small">Biome
            <select className="input" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as SubjectId | 'all')}>
              {BIOMES.map(b => <option key={b} value={b}>{b === 'all' ? 'Tous' : SUBJECT_LABEL_FR[b]}</option>)}
            </select>
          </label>
          <label className="small" style={{ flex:1, minWidth: 220 }}>Recherche bloc
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="label ou id" />
          </label>
        </div>

        <div style={{ marginTop:10 }}>
          {filtered.length === 0 ? (
            <div className="small">Aucun bloc pour ce filtre.</div>
          ) : (
            <label className="small" style={{ display:'block' }}>
              Bloc (tagId)
              <select
                className="input"
                size={Math.min(10, Math.max(4, filtered.length))}
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                style={{ width:'100%', marginTop:6 }}
              >
                {filtered.map((b) => {
                  const meta = getTagMeta(b.tagId)
                  return (
                    <option key={b.tagId} value={b.tagId}>
                      {meta.label} — {meta.id}
                    </option>
                  )
                })}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop:0 }}>Options</h3>
        <div className="row" style={{ gap: 10, flexWrap:'wrap' }}>
          <label className="small">Taille du pack
            <input className="input" type="number" min={1} value={packSize} onChange={(e) => setPackSize(Number(e.target.value) || 0)} />
          </label>
          <label className="small">Profil difficulté
            <select className="input" value={difficultyProfile} onChange={(e) => setDifficultyProfile(e.target.value as DifficultyProfile)}>
              <option value="balanced">balanced</option>
              <option value="easy">easy</option>
              <option value="hard">hard</option>
            </select>
          </label>
          <label className="small">Profil mix
            <select className="input" value={mixProfile} onChange={(e) => setMixProfile(e.target.value as MixProfile)}>
              <option value="standard">standard</option>
              <option value="mcq_only">mcq_only</option>
              <option value="mcq_heavy">mcq_heavy</option>
              <option value="with_error_spotting">with_error_spotting</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ gap: 10, flexWrap:'wrap', marginTop:8 }}>
          <label className="small row" style={{ gap:6, alignItems:'center' }}>
            <input type="checkbox" checked={avoidFillBlankAmbiguous} onChange={(e) => setAvoidFillBlankAmbiguous(e.target.checked)} />
            Pas de texte à trou ambigu
          </label>
          <label className="small row" style={{ gap:6, alignItems:'center' }}>
            <input type="checkbox" checked={includeLesson} onChange={(e) => setIncludeLesson(e.target.checked)} />
            Inclure lesson + ancres
          </label>
          <label className="small">Source leçon
            <select className="input" value={lessonSource} onChange={(e) => setLessonSource(e.target.value as LessonSource)}>
              <option value="from_block_reference">from_block_reference</option>
              <option value="manual_override">manual_override</option>
            </select>
          </label>
        </div>
        {lessonSource === 'manual_override' && (
          <label className="small" style={{ display:'block', marginTop:10 }}>
            Markdown de leçon (override)
            <textarea className="input" style={{ minHeight: 120 }} value={manualLessonMarkdown} onChange={(e) => setManualLessonMarkdown(e.target.value)} />
          </label>
        )}
        <label className="small" style={{ display:'block', marginTop:10 }}>
          Notes
          <textarea className="input" style={{ minHeight: 80 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0 }}>Markdown généré</h3>
          <div className="row" style={{ gap:6 }}>
            <button className="btn secondary" onClick={onCopy} disabled={!markdown}>Copier</button>
            <button className="btn secondary" onClick={onDownload} disabled={!markdown}>Télécharger .md</button>
          </div>
        </div>
        {copyStatus && <div className="small" style={{ marginTop:6 }}>{copyStatus}</div>}
        <textarea className="input" style={{ marginTop:10, minHeight: 280, fontFamily:'monospace' }} value={markdown} readOnly />
      </div>
    </div>
  )
}
