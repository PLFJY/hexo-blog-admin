const emptyDraftId = '__empty-draft-id__'

export const normalizeRelativeId = (relativeId: string) =>
  relativeId
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')

export const resolveDraftId = (id: string) => (id === emptyDraftId ? '' : id)

export const isValidRelativeId = (relativeId: string) => {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized) return false
  if (normalized.startsWith('.') || normalized.includes('..')) return false
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git')) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(normalized)
}

export const createDraftId = (relativeId: string) =>
  normalizeRelativeId(relativeId).replace(/[^a-zA-Z0-9/_-]/g, '-')

export const visibleDraftId = (id: string) => id || emptyDraftId
