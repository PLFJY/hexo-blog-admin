import type { DeployLatestResponse } from '../shared/deployTypes'
import type { PostTreeResponse } from '../shared/postTypes'

const INDEX_CACHE_KEY = 'admin_index_cache'
const DEPLOY_CACHE_KEY = 'admin_deploy_cache'

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

export function getCachedDeployStatus(): DeployLatestResponse | null {
  try {
    const cached = localStorage.getItem(DEPLOY_CACHE_KEY)
    if (!cached) return null
    return JSON.parse(cached) as DeployLatestResponse
  } catch (e) {
    console.error('Failed to parse cached deploy status', e)
    return null
  }
}

export function setCachedDeployStatus(status: DeployLatestResponse) {
  try {
    localStorage.setItem(DEPLOY_CACHE_KEY, JSON.stringify(status))
  } catch (e) {
    console.error('Failed to cache deploy status', e)
  }
}
