import type { PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'

export function buildIndexUrl(env: WorkerEnv) {
  const config = requireConfig(env)
  const publicUrl = config.BLOG_PUBLIC_URL.replace(/\/+$/g, '')

  return `${publicUrl}${config.ADMIN_INDEX_PATH.startsWith('/') ? '' : '/'}${config.ADMIN_INDEX_PATH}`
}

export async function fetchOnlineAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  const response = await fetch(buildIndexUrl(env), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'hexo-blog-admin',
      'Cache-Control': 'no-cache',
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch admin index: ${response.status}`)
  }

  return (await response.json()) as PostTreeResponse
}

export async function syncOnlineAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  return await fetchOnlineAdminIndex(env)
}

export async function getAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  return await fetchOnlineAdminIndex(env)
}
