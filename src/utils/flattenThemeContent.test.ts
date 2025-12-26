import { flattenThemeContent } from './flattenThemeContent'
import type { Exercise } from '../types'

function ex(id: string): Exercise {
  return { id, themeId: 't1', type: 'mcq', prompt: 'Q', choices: ['a','b'], answerIndex:0, difficulty:1, tags: ['fr_test'] }
}

// Theme sans readings
const out1 = flattenThemeContent({ exercises: [ex('e1')] })
console.assert(out1.length === 1 && out1[0].id === 'e1', 'Theme sans readings')

// Theme avec readings
const out2 = flattenThemeContent({
  exercises: [],
  readings: [{
    id: 'r1', title: 'Lecture 1', text: 'Texte', difficulty: 1, tags: ['fr_read'], questions: [ex('rq1')]
  }]
})
console.assert(out2.length === 1 && out2[0].readingContext?.readingId === 'r1', 'Theme avec readings')

// Theme mixte
const out3 = flattenThemeContent({
  exercises: [ex('e2')],
  readings: [{
    id: 'r2', title: 'Lecture 2', text: 'Texte 2', difficulty: 2, tags: ['fr_read'], questions: [ex('rq2')]
  }]
})
console.assert(out3.length === 2, 'Theme mixte')
