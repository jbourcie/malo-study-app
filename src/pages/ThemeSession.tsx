import React from 'react'
import { useParams } from 'react-router-dom'
import { listExercises, saveAttemptAndRewards } from '../data/firestore'
import { saveSessionWithProgress } from '../data/progress'
import { useAuth } from '../state/useAuth'
import type { Exercise, ExerciseMCQ, ExerciseShortText, ExerciseFillBlank, SubjectId } from '../types'
import { normalize } from '../utils/normalize'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

type AnswerState = Record<string, any>

function isCorrect(ex: Exercise, ans: any): boolean {
  if (ex.type === 'mcq') return ans === (ex as ExerciseMCQ).answerIndex
  if (ex.type === 'short_text') return (ex as ExerciseShortText).expected.includes(normalize(ans || ''))
  if (ex.type === 'fill_blank') return (ex as ExerciseFillBlank).expected.includes(normalize(ans || ''))
  return false
}

export function ThemeSessionPage() {
  const { themeId } = useParams()
  const { user } = useAuth()
  const [theme, setTheme] = React.useState<any | null>(null)
  const [exos, setExos] = React.useState<Exercise[]>([])
  const [answers, setAnswers] = React.useState<AnswerState>({})
  const [startedAt] = React.useState<number>(() => Date.now())
  const [result, setResult] = React.useState<any | null>(null)
  const [weakTags, setWeakTags] = React.useState<string[]>([])

  React.useEffect(() => {
    (async () => {
      if (!themeId) return
      const tSnap = await getDoc(doc(db, 'themes', themeId))
      setTheme(tSnap.exists() ? { id: themeId, ...tSnap.data() } : null)

      const list = await listExercises(themeId)
      // session du jour: 10 questions max (ou moins si thème petit)
      const shuffled = [...list].sort(() => Math.random() - 0.5)
      setExos(shuffled.slice(0, 10))
      setAnswers({})
      setResult(null)
    })()
  }, [themeId])

  const submit = async () => {
    if (!user || !themeId || !theme) return
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))

    const items = exos.map(ex => ({
      exerciseId: ex.id,
      difficulty: ex.difficulty,
      tags: ex.tags || [],
      correct: isCorrect(ex, answers[ex.id])
    }))

    const progress = await saveSessionWithProgress({
      uid: user.uid,
      subjectId: theme.subjectId as SubjectId,
      themeId,
      answers,
      exercises: exos,
      durationSec,
    })

    const rewards = await saveAttemptAndRewards({
      uid: user.uid,
      subjectId: theme.subjectId as SubjectId,
      themeId,
      items,
      durationSec,
      existingAttemptId: progress.attemptId,
      skipAttemptWrite: true,
    })

    const sessionTags = new Set<string>(exos.flatMap(ex => ex.tags || []))
    const sortedWeak = Object.values(progress.tagsUpdated || {})
      .filter(t => t && sessionTags.has(t.tagId || ''))
      .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
      .slice(0, 3)
      .map(t => t.tagId!)

    setWeakTags(sortedWeak)
    setResult({ score: rewards.score, outOf: rewards.outOf, durationSec, ...rewards })
  }

  if (!themeId) return <div className="container"><div className="card">Thème introuvable.</div></div>

  return (
    <div className="container grid">
      <div className="card">
        <h2 style={{ margin:0 }}>{theme?.title || 'Session'}</h2>
        <div className="small">Fais de ton mieux. Objectif : régularité 🙂</div>
      </div>

      {exos.map((ex, idx) => (
        <div className="card" key={ex.id}>
          <div className="small">Question {idx+1} / {exos.length} <span className="badge">Difficulté {ex.difficulty}</span></div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>{ex.prompt}</div>

          {ex.type === 'mcq' && (
            <div className="grid" style={{ marginTop: 10 }}>
              {(ex as ExerciseMCQ).choices.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={"btn " + ((answers[ex.id] === i) ? '' : 'secondary')}
                  onClick={() => setAnswers(a => ({ ...a, [ex.id]: i }))}
                  style={{ textAlign:'left', opacity: answers[ex.id] === i ? 1 : 0.85 }}
                  aria-pressed={answers[ex.id] === i}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {(ex.type === 'short_text') && (
            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                placeholder="Ta réponse…"
                value={answers[ex.id] ?? ''}
                onChange={(e) => setAnswers(a => ({ ...a, [ex.id]: e.target.value }))}
              />
            </div>
          )}

          {(ex.type === 'fill_blank') && (
            <div style={{ marginTop: 10 }}>
              <div className="small">{(ex as ExerciseFillBlank).text}</div>
              <input
                className="input"
                placeholder="Le mot manquant…"
                value={answers[ex.id] ?? ''}
                onChange={(e) => setAnswers(a => ({ ...a, [ex.id]: e.target.value }))}
              />
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <div className="row">
          <button className="btn" onClick={submit}>Corriger et enregistrer</button>
          {result && (
            <div className="small">
              Score <strong>{result.score}/{result.outOf}</strong> · {result.durationSec}s ·
              +<strong>{result.xpGain}</strong> XP · +<strong>{result.coinsGain}</strong> pièces · Série <strong>{result.streakDays}</strong>
            </div>
          )}
        </div>
        {result?.badges?.length ? (
          <div className="row" style={{ marginTop: 10 }}>
            {result.badges.map((b: string) => <span key={b} className="badge">{b}</span>)}
          </div>
        ) : null}
        {weakTags.length ? (
          <div className="small" style={{ marginTop: 10 }}>
            Tags à renforcer (thème) : {weakTags.map(t => <span key={t} className="badge">{t}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
