import type { PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'
import { githubJson } from '../github/githubClient'

const ADMIN_INDEX_CACHE_KEY = 'index:online'
const ADMIN_INDEX_CACHE_MAX_AGE_MS = 30_000

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

async function getSourceBranchHeadSha(env: WorkerEnv): Promise<string | undefined> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(config.GITHUB_OWNER)
  const repo = encodeURIComponent(config.GITHUB_REPO)
  const branch = encodeURIComponent(config.GITHUB_BRANCH)
  const ref = await githubJson<{ object?: { sha?: string } }>(env, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
  return ref.object?.sha
}

async function readCachedAdminIndex(env: WorkerEnv): Promise<PostTreeResponse | null> {
  const cached = await env.BLOG_ADMIN_KV?.get(ADMIN_INDEX_CACHE_KEY)
  if (!cached) return null
  return { ...(JSON.parse(cached) as PostTreeResponse), stale: true }
}

async function writeCachedAdminIndex(env: WorkerEnv, index: PostTreeResponse, sourceCommitSha?: string) {
  const cacheValue: PostTreeResponse = {
    ...index,
    stale: false,
    sourceCommitSha: index.sourceCommitSha ?? sourceCommitSha,
    cacheSyncedAt: new Date().toISOString(),
  }
  await env.BLOG_ADMIN_KV?.put(ADMIN_INDEX_CACHE_KEY, JSON.stringify(cacheValue))
  return cacheValue
}

function isCacheFresh(index: PostTreeResponse) {
  if (!index.cacheSyncedAt) return false
  const syncedAt = Date.parse(index.cacheSyncedAt)
  return Number.isFinite(syncedAt) && Date.now() - syncedAt < ADMIN_INDEX_CACHE_MAX_AGE_MS
}

export async function syncOnlineAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  const sourceCommitSha = await getSourceBranchHeadSha(env).catch(() => undefined)
  const index = await fetchOnlineAdminIndex(env)
  return await writeCachedAdminIndex(env, index, sourceCommitSha)
}

export async function getAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  const cached = await readCachedAdminIndex(env)
  const sourceCommitSha = await getSourceBranchHeadSha(env).catch(() => undefined)
  if (cached && sourceCommitSha && cached.sourceCommitSha === sourceCommitSha && isCacheFresh(cached)) {
    return { ...cached, stale: false }
  }

  try {
    const index = await fetchOnlineAdminIndex(env)
    return await writeCachedAdminIndex(env, index, sourceCommitSha)
  } catch (error) {
    // If the public blog is between deploy states, keep the admin usable with the last known index.
    if (cached) return cached
    throw error
  }
}
