// Normalisation des réponses ouvertes :
// - minuscule
// - NFD + suppression des diacritiques (accents)
// - unification de l’apostrophe courbe en apostrophe simple
// - réduction des espaces multiples
// - trim final
export function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
