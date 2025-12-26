export type BadgeDef = {
  id: string
  title: string
  description: string
  icon: string
}

export const BADGES: BadgeDef[] = [
  { id: 'streak_3', title: 'Série 3', description: '3 jours de suite', icon: '🔥' },
  { id: 'streak_7', title: 'Série 7', description: '7 jours de suite', icon: '🏅' },
  { id: 'retry_5', title: 'Persévérant', description: '5 erreurs revues', icon: '🔁' },
  { id: 'tag_master_3', title: 'Maître x3', description: '3 tags maîtrisés', icon: '🎯' },
  { id: 'tag_master_10', title: 'Maître x10', description: '10 tags maîtrisés', icon: '🏆' },
  { id: 'fractions_first_mastery', title: 'As des fractions', description: '1er tag fractions maîtrisé', icon: '➗' },
  { id: 'grammar_first_mastery', title: 'As de grammaire', description: '1er tag grammaire maîtrisé', icon: '✏️' },
  { id: 'sessions_10', title: 'Marathon 10', description: '10 séances terminées', icon: '🎽' },
]
