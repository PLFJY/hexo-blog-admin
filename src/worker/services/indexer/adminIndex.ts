import type { PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'

const ADMIN_INDEX_CACHE_KEY = 'index:online'

function buildIndexUrl(env: WorkerEnv) {
  const config = requireConfig(env)
  const publicUrl = config.BLOG_PUBLIC_URL.replace(/\/+$/g, '')

  return `${publicUrl}${config.ADMIN_INDEX_PATH.startsWith('/') ? '' : '/'}${config.ADMIN_INDEX_PATH}`
}

async function fetchOnlineAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  const response = await fetch(buildIndexUrl(env), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'hexo-blog-admin',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch admin index: ${response.status}`)
  }

  return (await response.json()) as PostTreeResponse
}

async function readCachedAdminIndex(env: WorkerEnv): Promise<PostTreeResponse | null> {
  const cached = await env.BLOG_ADMIN_KV?.get(ADMIN_INDEX_CACHE_KEY)
  if (!cached) return null
  return { ...(JSON.parse(cached) as PostTreeResponse), stale: true }
}

async function writeCachedAdminIndex(env: WorkerEnv, index: PostTreeResponse) {
  const cacheValue: PostTreeResponse = { ...index, stale: false }
  await env.BLOG_ADMIN_KV?.put(ADMIN_INDEX_CACHE_KEY, JSON.stringify(cacheValue))
}

export async function syncOnlineAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  const index = await fetchOnlineAdminIndex(env)
  await writeCachedAdminIndex(env, index)
  return { ...index, stale: false }
}

export async function getAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  try {
    return await syncOnlineAdminIndex(env)
  } catch (error) {
    const cached = await readCachedAdminIndex(env)
    if (cached) return cached
    throw error
  }
}
