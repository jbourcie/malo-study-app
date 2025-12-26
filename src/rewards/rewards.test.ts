import { updateMasteryFromAttempt } from './rewards'

// Case 1: correct answer boosts score
const m1 = updateMasteryFromAttempt({
  masteryByTag: {},
  questionTags: ['tag1'],
  isCorrect: true,
  timestamp: {} as any,
})
console.assert(m1['tag1'].score === 8 && m1['tag1'].state === 'discovering', 'Correct should add 8')

// Case 2: incorrect adds small progress
const m2 = updateMasteryFromAttempt({
  masteryByTag: { tag1: { score: 25, state: 'discovering', updatedAt: {} as any } },
  questionTags: ['tag1'],
  isCorrect: false,
  timestamp: {} as any,
})
console.assert(m2['tag1'].score === 27, 'Incorrect should add 2')
