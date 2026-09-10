import type { PostTreeResponse } from '../shared/postTypes'

const INDEX_CACHE_KEY = 'admin_index_cache'

export function getCachedAdminIndex(): PostTreeResponse | null {
  try {
    const cached = localStorage.getItem(INDEX_CACHE_KEY)
    if (!cached) return null
    return JSON.parse(cached) as PostTreeResponse
  } catch (e) {
    console.error('Failed to parse cached admin index', e)
    return null
  }
}

export function setCachedAdminIndex(index: PostTreeResponse) {
  try {
    localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(index))
  } catch (e) {
    console.error('Failed to cache admin index', e)
  }
}
