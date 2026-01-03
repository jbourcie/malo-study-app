export function slugifyZoneLabel(input: string): string {
  const trimmed = (input || '').trim().toLowerCase()
  if (!trimmed) return 'zone'
  let slug = trimmed.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  slug = slug
    .replace(/&/g, ' et ')
    .replace(/['’]/g, '')
    .replace(/-/g, '_')
  slug = slug.replace(/[^a-z0-9]/g, ' ')
  slug = slug.replace(/\s+/g, ' ')
  slug = slug.replace(/ /g, '_')
  slug = slug.replace(/_+/g, '_')
  slug = slug.replace(/^_+|_+$/g, '')
  return slug || 'zone'
}

export function zoneKey(subjectId: string, themeLabel: string): string {
  return `${subjectId}:${slugifyZoneLabel(themeLabel)}`
}
