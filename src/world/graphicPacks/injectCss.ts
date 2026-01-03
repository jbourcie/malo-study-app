export function injectCssUrls(cssUrls: string[], key: string): () => void {
  const head = document.querySelector('head')
  if (!head) return () => {}

  cssUrls.forEach((href) => {
    const selector = `link[data-mc-pack="${key}"][href="${href}"]`
    if (head.querySelector(selector)) return
    const link = document.createElement('link')
    link.setAttribute('rel', 'stylesheet')
    link.setAttribute('href', href)
    link.dataset.mcPack = key
    head.appendChild(link)
  })

  return () => {
    head.querySelectorAll(`link[data-mc-pack="${key}"]`).forEach((node) => node.remove())
  }
}
