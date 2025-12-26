export function getSessionFeedback(opts: { accuracy: number; weakestTag?: string | null; improvedTag?: string | null }) {
  const { accuracy, weakestTag, improvedTag } = opts
  const weak = weakestTag || improvedTag || 'ce tag'
  if (accuracy < 50) return `On avance : demain, on reprend ${weak} avec 5 minutes de révision.`
  if (accuracy < 80) return `Bien joué : encore un effort sur ${weak} et ça passe.`
  return `Super : tu maîtrises bien ${improvedTag || weak}, on peut monter d’un cran.`
}
