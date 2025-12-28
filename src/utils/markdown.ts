const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function applyInline(text: string): string {
  let t = text
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\*(.*?)\*/g, '<em>$1</em>')
  t = t.replace(/`(.*?)`/g, '<code>$1</code>')
  return t
}

function renderHeading(line: string): string | null {
  const match = line.match(/^(\#{1,6})\s+(.*)$/)
  if (!match) return null
  const level = match[1].length
  let text = match[2] || ''
  const anchorMatch = text.match(/\s*\{#([^\}]+)\}\s*$/)
  let anchor: string | null = null
  if (anchorMatch) {
    anchor = anchorMatch[1]
    text = text.replace(/\s*\{#([^\}]+)\}\s*$/, '')
  }
  const safe = applyInline(escapeHtml(text.trim()))
  return `<h${level}${anchor ? ` id="${anchor}"` : ''}>${safe}</h${level}>`
}

/**
 * Mini-conversion Markdown -> HTML (titres avec ancres {#id}, bold, italic, code, retours ligne).
 * Suffisant pour les rappels de leçon sans dépendance externe.
 */
export function markdownToHtml(md: string): string {
  if (!md) return ''
  const lines = md.split('\n')
  const htmlLines = lines.map((line) => {
    const heading = renderHeading(line)
    if (heading) return heading
    const safe = escapeHtml(line)
    return applyInline(safe)
  })
  return htmlLines.join('<br />')
}

/**
 * Extrait une section d'un markdown en ciblant une ancre {#anchorId} sur un titre.
 * Retourne le bloc (titre + contenu jusqu'au prochain titre de même niveau) ou null.
 */
export function extractLessonSection(markdown: string, anchorId: string): { title?: string, markdown: string } | null {
  if (!markdown || !anchorId) return null
  const anchor = anchorId.replace(/^#/, '').trim()
  if (!anchor) return null

  const lines = markdown.split('\n')
  let start = -1
  let level = 0
  let title: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\#{1,6})\s+(.*)$/)
    if (!m) continue
    const anchorMatch = m[2].match(/\{#([^\}]+)\}\s*$/)
    if (anchorMatch && anchorMatch[1] === anchor) {
      start = i
      level = m[1].length
      title = m[2].replace(/\s*\{#([^\}]+)\}\s*$/, '').trim()
      break
    }
  }

  if (start === -1) return null
  const collected: string[] = [lines[start]]
  for (let j = start + 1; j < lines.length; j++) {
    const m = lines[j].match(/^(\#{1,6})\s+(.*)$/)
    if (m && m[1].length <= level) break
    collected.push(lines[j])
  }
  const sectionMarkdown = collected.join('\n').trim()
  if (!sectionMarkdown) return null
  return { title, markdown: sectionMarkdown }
}
