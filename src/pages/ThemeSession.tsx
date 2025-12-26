import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listExercises, listReadings, saveAttemptAndRewards } from '../data/firestore'
import { saveSessionWithProgress } from '../data/progress'
import { useAuth } from '../state/useAuth'
import type { Exercise, ExerciseMCQ, ExerciseShortText, ExerciseFillBlank, SubjectId, Reading } from '../types'
import { normalize } from '../utils/normalize'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { flattenThemeContent, PlayableExercise } from '../utils/flattenThemeContent'
import { computeSessionXp, computeLevelFromXp } from '../rewards/rewards'
import { awardSessionRewards } from '../rewards/rewardsService'
import { useUserRewards } from '../state/useUserRewards'
import { RewardsHeader } from '../components/RewardsHeader'

type AnswerState = Record<string, any>

function isCorrect(ex: Exercise, ans: any): boolean {
  if (ex.type === 'mcq') return ans === (ex as ExerciseMCQ).answerIndex
  if (ex.type === 'short_text') return (ex as ExerciseShortText).expected.includes(normalize(ans || ''))
  if (ex.type === 'fill_blank') return (ex as ExerciseFillBlank).expected.includes(normalize(ans || ''))
  return false
}

function renderUnderlined(text: string) {
  const parts: React.ReactNode[] = []
  const regex = /_([^_]+)_/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push(<span key={`u-${key++}`} style={{ textDecoration: 'underline' }}>{m[1]}</span>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

export function ThemeSessionPage() {
  const { themeId } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const { rewards: liveRewards } = useUserRewards(user?.uid || null)
  const [theme, setTheme] = React.useState<any | null>(null)
  const [exos, setExos] = React.useState<PlayableExercise[]>([])
  const [answers, setAnswers] = React.useState<AnswerState>({})
  const [startedAt] = React.useState<number>(() => Date.now())
  const [result, setResult] = React.useState<any | null>(null)
  const [weakTags, setWeakTags] = React.useState<string[]>([])
  const [feedback, setFeedback] = React.useState<Array<{
    id: string
    prompt: string
    correct: boolean
    expected: string
    userAnswer: string
    idx: number
  }>>([])
  const [showCorrections, setShowCorrections] = React.useState(false)
  const [sessionRewards, setSessionRewards] = React.useState<{ deltaXp: number, levelUp: boolean, newRewards?: any, prevRewards?: any } | null>(null)
  const [showRewardModal, setShowRewardModal] = React.useState(false)

  React.useEffect(() => {
    (async () => {
      if (!themeId) return
      const tSnap = await getDoc(doc(db, 'themes', themeId))
      const tData = tSnap.exists() ? { id: themeId, ...tSnap.data() } : null
      setTheme(tData)

      const exercises = await listExercises(themeId, { uid: user?.uid })
      const readingsFromTheme = Array.isArray((tData as any)?.readings) ? (tData as any).readings : []
      let readings = readingsFromTheme
      try {
        const remote = await listReadings(themeId)
        if (remote.length) readings = remote
      } catch {
        // ignore
      }
      const content = flattenThemeContent({ exercises, readings })
      // session du jour: 10 questions max (ou moins si thème petit)
      const shuffled = [...content].sort(() => Math.random() - 0.5)
      setExos(shuffled.slice(0, 10))
      setAnswers({})
      setResult(null)
      setFeedback([])
      setShowCorrections(false)
    })()
  }, [themeId, user])

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

    const answeredCount = exos.reduce((acc, ex) => {
      const ans = answers[ex.id]
      if (ans === undefined || ans === null) return acc
      if (typeof ans === 'string' && ans.trim() === '') return acc
      return acc + 1
    }, 0)
    const deltaXp = computeSessionXp({ answeredCount, isCompleted: true })
    const prevRewards = liveRewards
    let newRewards = null
    let levelUp = false
    try {
      const res = await awardSessionRewards(user.uid, progress.attemptId || null, deltaXp)
      newRewards = res
      levelUp = (res?.level || 1) > (liveRewards?.level || 1)
    } catch (e) {
      console.error('awardSessionRewards failed', e)
      // fallback: do not block UX
    }
    setSessionRewards({ deltaXp, levelUp, newRewards, prevRewards })

    const sessionTags = new Set<string>(exos.flatMap(ex => ex.tags || []))
    const sortedWeak = Object.values(progress.tagsUpdated || {})
      .filter(t => t && sessionTags.has(t.tagId || ''))
      .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
      .slice(0, 3)
      .map(t => t.tagId!)

    setWeakTags(sortedWeak)
    setResult({ score: rewards.score, outOf: rewards.outOf, durationSec, ...rewards })

    const fb = exos.map((ex, idx) => {
      const userAns = answers[ex.id]
      const correct = isCorrect(ex, userAns)
      let expected = ''
      let userAnswer = ''
      if (ex.type === 'mcq') {
        const mcq = ex as ExerciseMCQ
        expected = mcq.choices[mcq.answerIndex] || ''
        userAnswer = typeof userAns === 'number' ? (mcq.choices[userAns] || '') : ''
      } else if (ex.type === 'short_text') {
        expected = (ex as ExerciseShortText).expected[0] || ''
        userAnswer = userAns || ''
      } else if (ex.type === 'fill_blank') {
        expected = (ex as ExerciseFillBlank).expected[0] || ''
        userAnswer = userAns || ''
      }
      return {
        id: ex.id,
        prompt: ex.prompt,
        correct,
        expected: expected || '—',
        userAnswer: (userAnswer ?? '').toString() || '—',
        idx: idx + 1,
      }
    })
    setFeedback(fb)
    setShowCorrections(true)
    setShowRewardModal(true)
  }

  if (!themeId) return <div className="container"><div className="card">Thème introuvable.</div></div>

  if (showCorrections && feedback.length) {
    const prevXp = sessionRewards?.prevRewards?.xp ?? liveRewards?.xp ?? 0
    const newXp = sessionRewards?.newRewards?.xp ?? prevXp
    const xpBefore = prevXp
    const xpAfter = newXp
    const xpDelta = sessionRewards?.deltaXp ?? 0
    const message = result ? (() => {
      const rate = result.outOf ? (result.score / result.outOf) * 100 : 0
      if (rate >= 80) return 'Super ! Continue comme ça.'
      if (rate >= 50) return 'Bien joué ! On consolide et ça va monter.'
      return 'Bien essayé. On progresse en s’entraînant.'
    })() : ''

    return (
      <div className="container grid" style={{ position: 'relative' }}>
        {showRewardModal && (
          <div style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:999
          }}>
            <div className="card" style={{ maxWidth: 420 }}>
              <h3 style={{ marginTop: 0 }}>Bravo {user?.displayName?.split(' ')[0] || '!'}</h3>
              <div className="small">Score {result?.score}/{result?.outOf}</div>
              <div className="small" style={{ marginTop: 6 }}>+{sessionRewards?.deltaXp ?? 0} XP</div>
              {sessionRewards?.levelUp && (
                <div className="small" style={{ marginTop: 6 }}>🎉 Niveau {sessionRewards?.newRewards?.level}</div>
              )}
              {message && <div className="small" style={{ marginTop: 8 }}>{message}</div>}
              <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowRewardModal(false)}>Voir la correction</button>
            </div>
          </div>
        )}
        <div className="card">
          <h2 style={{ margin:0 }}>Corrections – {theme?.title}</h2>
          {result && (
            <div className="small">
              Score <strong>{result.score}/{result.outOf}</strong> · {result.durationSec}s · +{result.xpGain} XP · +{result.coinsGain} pièces
            </div>
          )}
          {sessionRewards && (
            <div className="small" style={{ marginTop: 8 }}>
              +{sessionRewards.deltaXp} XP {sessionRewards.levelUp ? `· 🎉 Niveau ${sessionRewards.newRewards?.level}` : ''}
            </div>
          )}
          {message && <div className="small" style={{ marginTop: 8 }}>{message}</div>}
        </div>

        <div className="card">
          <div className="grid">
            {feedback.map(f => (
              <div key={f.id} className="pill" style={{
                display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6,
                background: f.correct ? 'rgba(46, 204, 113, 0.12)' : 'rgba(255, 90, 111, 0.12)',
                border: f.correct ? '1px solid rgba(46, 204, 113, 0.4)' : '1px solid rgba(255, 90, 111, 0.4)'
              }}>
                <div className="small">
                  Question {f.idx} • {f.correct ? <span className="badge" style={{ borderColor:'rgba(46,204,113,.6)', color:'#7fffb2' }}>✔️ Bonne réponse</span> : <span className="badge" style={{ borderColor:'rgba(255,90,111,.6)', color:'#ff9fb0' }}>❌ Mauvaise réponse</span>}
                </div>
                <div style={{ fontWeight: 700 }}>{f.prompt}</div>
                <div className="small">Ta réponse : <strong>{f.userAnswer}</strong></div>
                {!f.correct && <div className="small">Correction : <strong>{f.expected}</strong></div>}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => nav('/')}>Retour à l’accueil</button>
            <button className="btn secondary" onClick={() => { setShowCorrections(false); setFeedback([]); setResult(null); setAnswers({}); }}>Refaire une session</button>
          </div>
        </div>

        {sessionRewards && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Progression XP</h3>
            <div className="small">XP : {xpBefore} → {xpAfter}</div>
            {(() => {
              const before = computeLevelFromXp(xpBefore)
              const after = computeLevelFromXp(xpAfter)
              const progress = Math.min(100, Math.max(0, Math.round(after.xpIntoLevel / after.xpForNext * 100)))
              return (
                <>
                  <div className="small">Niveau : {before.level} → {after.level}</div>
                  <div style={{ height: 12, background:'rgba(255,255,255,0.08)', borderRadius: 999, overflow:'hidden', marginTop: 8 }}>
                    <div style={{
                      height: '100%',
                      width: `${progress}%`,
                      background:'linear-gradient(90deg,#7aa2ff,#2ecc71)',
                      transition:'width 0.6s ease'
                    }} />
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container grid">
      <div className="card">
        <h2 style={{ margin:0 }}>{theme?.title || 'Session'}</h2>
        <div className="small">Fais de ton mieux. Objectif : régularité 🙂</div>
      </div>

      <RewardsHeader rewards={liveRewards} />

      {exos.map((ex, idx) => {
        const readingCtx = (ex as any).readingContext
        const showReading = readingCtx && (idx === 0 || (exos[idx - 1] as any).readingContext?.readingId !== readingCtx.readingId)
        return (
          <div className="card" key={ex.id}>
            {showReading && readingCtx && (
              <div style={{ marginBottom: 10 }}>
                <div className="small" style={{ marginBottom: 4 }}>Lecture : {readingCtx.title}</div>
                <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{renderUnderlined(readingCtx.text)}</div>
                <hr />
              </div>
            )}
            <div className="small">Question {idx + 1} / {exos.length} <span className="badge">Difficulté {ex.difficulty}</span></div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>{renderUnderlined(ex.prompt)}</div>

            {ex.type === 'mcq' && (
              <div className="grid" style={{ marginTop: 10 }}>
                {(ex as ExerciseMCQ).choices.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={"btn " + ((answers[ex.id] === i) ? '' : 'secondary')}
                    onClick={() => setAnswers(a => ({ ...a, [ex.id]: i }))}
                    style={{ textAlign: 'left', opacity: answers[ex.id] === i ? 1 : 0.85 }}
                    aria-pressed={answers[ex.id] === i}
                  >
                    {renderUnderlined(c)}
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
                <div className="small">{renderUnderlined((ex as ExerciseFillBlank).text)}</div>
                <input
                  className="input"
                  placeholder="Le mot manquant…"
                  value={answers[ex.id] ?? ''}
                  onChange={(e) => setAnswers(a => ({ ...a, [ex.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        )
      })}

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

      {feedback.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Corrections</h3>
          <div className="grid">
            {feedback.map(f => (
              <div key={f.id} className="pill" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                <div className="small">Question {f.idx} • {f.correct ? <span className="badge">✔️ Bonne réponse</span> : <span className="badge">❌ Mauvaise réponse</span>}</div>
                <div style={{ fontWeight: 700 }}>{f.prompt}</div>
                <div className="small">Ta réponse : <strong>{f.userAnswer}</strong></div>
                {!f.correct && <div className="small">Correction : <strong>{f.expected}</strong></div>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
