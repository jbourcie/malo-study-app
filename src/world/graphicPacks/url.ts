export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '')
}

export function joinUrl(base: string, path: string): string {
  const cleanBase = trimTrailingSlash(base)
  const cleanPath = trimLeadingSlash(path)
  if (!cleanPath) return cleanBase
  if (!cleanBase) return `/${cleanPath}`
  return `${cleanBase}/${cleanPath}`
}
