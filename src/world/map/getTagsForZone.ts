import { TAG_CATALOG, type SubjectId } from '../../taxonomy/tagCatalog'
import { slugifyZoneLabel } from '../slug'

export function getTagsForZone(subjectId: SubjectId, themeLabel: string) {
  const targetSlug = slugifyZoneLabel(themeLabel)
  return Object.values(TAG_CATALOG).filter(
    (meta) => meta.subject === subjectId && slugifyZoneLabel(meta.theme) === targetSlug,
  )
}
