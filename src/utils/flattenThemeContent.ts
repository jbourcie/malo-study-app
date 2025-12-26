import type { Exercise, Reading } from '../types'

export type PlayableExercise = Exercise & {
  readingContext?: {
    readingId: string
    title: string
    text: string
  }
}

export function flattenThemeContent(theme: {
  exercises?: Exercise[]
  readings?: Reading[]
}): PlayableExercise[] {
  const items: PlayableExercise[] = []
  if (Array.isArray(theme.exercises)) {
    items.push(...theme.exercises)
  }
  if (Array.isArray(theme.readings)) {
    theme.readings.forEach(reading => {
      if (!Array.isArray(reading.questions)) return
      reading.questions.forEach(q => {
        items.push({
          ...q,
          readingContext: {
            readingId: reading.id,
            title: reading.title,
            text: reading.text,
          },
        })
      })
    })
  }
  return items
}
