export type Role = 'parent' | 'child'

export type SubjectId = 'fr' | 'math' | 'en' | 'es' | 'hist'

export type ExerciseType = 'mcq' | 'short_text' | 'fill_blank'

export interface Theme {
  id: string
  subjectId: SubjectId
  title: string
  grade: '5e'
  readings?: Reading[]
  exercises?: Exercise[]
}

export interface ExerciseBase {
  id: string
  themeId: string
  type: ExerciseType
  prompt: string
  difficulty: 1 | 2 | 3
  tags: string[] // 1 à 3 tags pédagogiques issus de la taxonomie
}

export interface ExerciseMCQ extends ExerciseBase {
  type: 'mcq'
  choices: string[]
  answerIndex: number
}

export interface ExerciseShortText extends ExerciseBase {
  type: 'short_text'
  expected: string[] // réponses acceptées (normalisées)
}

export interface ExerciseFillBlank extends ExerciseBase {
  type: 'fill_blank'
  text: string // ex: "Le ____ noir dort."
  expected: string[] // mots acceptés
}

export type Exercise = ExerciseMCQ | ExerciseShortText | ExerciseFillBlank

export interface Reading {
  id: string
  title: string
  text: string
  difficulty: 1 | 2 | 3
  tags: string[]
  questions: ExerciseMCQ[]
}

export interface PackJSON {
  version: number
  grade: '5e'
  subjects: Array<{
    id: SubjectId
    title: string
    themes: Array<{
      id: string
      title: string
      exercises: Array<any>
    }>
  }>
}
