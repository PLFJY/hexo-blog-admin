/**
 * Post IDs ("relativeId") are the post path relative to POSTS_DIR without the
 * `.md` suffix, e.g. `VibeCoding的下一步是学会放手` or `ap-csa/00-about-ap-csa`.
 *
 * They are used as real file names, so the rules match what Git/Hexo can store on
 * every common platform: any character except the Windows-illegal set, no empty
 * `.`/`..`/`.git` segments, no control characters, no leading/trailing dot or
 * space in a segment. CJK is explicitly allowed because this blog names posts in
 * Chinese.
 */
const ILLEGAL_CHARS = /[\\:*?"<>|\u0000-\u001f]/

export const normalizeRelativeId = (relativeId: string) =>
  relativeId
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')

export const isValidRelativeId = (relativeId: string) => {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized) return false
  if (ILLEGAL_CHARS.test(normalized)) return false

  return normalized.split('/').every((part) => {
    if (!part || part === '.' || part === '..' || part === '.git') return false
    if (part.startsWith('.') || part.endsWith('.')) return false
    if (part !== part.trim()) return false
    return true
  })
}

/** Stable 32-bit FNV-1a hash, used to keep slugged draft ids unique. */
const fnv1a = (value: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * D1 primary key for a draft. ASCII slugs are kept as-is; when slugging drops
 * information (CJK titles, punctuation) a short hash is appended so two different
 * post IDs can never collapse into one draft row.
 */
export const createDraftId = (relativeId: string) => {
  const normalized = normalizeRelativeId(relativeId)
  const slug = normalized.replace(/[^a-zA-Z0-9/_-]/g, '-')
  const lossy = slug !== normalized || slug.replace(/-/g, '').length === 0
  if (!lossy) return slug
  const trimmed = slug.replace(/^-+|-+$/g, '') || 'draft'
  return `${trimmed}-${fnv1a(normalized)}`
}
