import type { PostAsset, PostAssetIndexResponse, PostFile, PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'
import { getAdminIndex } from './adminIndex'

type PostAssetShard = {
  assets?: unknown
}

function normalizeAssetIndexPath(assetIndexPath?: string) {
  const normalized = assetIndexPath?.trim().replace(/\\/g, '/')
  if (!normalized) return undefined
  if (normalized.includes('..') || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) return undefined
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function buildPublicJsonUrl(env: WorkerEnv, publicPath: string) {
  const config = requireConfig(env)
  const publicUrl = `${config.BLOG_PUBLIC_URL.replace(/\/+$/g, '')}/`
  return new URL(publicPath.replace(/^\/+/g, ''), publicUrl).toString()
}

function normalizeAssets(value: unknown): PostAsset[] {
  if (!Array.isArray(value)) return []
  return value.filter((asset): asset is PostAsset =>
    Boolean(
      asset &&
      typeof asset === 'object' &&
      'filename' in asset &&
      'repoPath' in asset &&
      'markdownPath' in asset &&
      typeof asset.filename === 'string' &&
      typeof asset.repoPath === 'string' &&
      typeof asset.markdownPath === 'string',
    ),
  )
}

async function fetchPostAssetShard(env: WorkerEnv, assetIndexPath: string): Promise<PostAsset[]> {
  const normalizedPath = normalizeAssetIndexPath(assetIndexPath)
  if (!normalizedPath) return []

  const response = await fetch(buildPublicJsonUrl(env, normalizedPath), {
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
  if (!response.ok) return []

  const shard = (await response.json()) as PostAssetShard
  return normalizeAssets(shard.assets)
}

export async function getPostSourceAssetsForPost(env: WorkerEnv, post: PostFile): Promise<PostAsset[]> {
  if (post.assetIndexPath) {
    try {
      return await fetchPostAssetShard(env, post.assetIndexPath)
    } catch {
      return []
    }
  }

  return normalizeAssets(post.assets)
}

export async function getPostSourceAssets(env: WorkerEnv, relativeId: string, index?: PostTreeResponse): Promise<PostAsset[]> {
  const adminIndex = index ?? await getAdminIndex(env)
  const post = adminIndex.posts.find((item) => item.relativeId === relativeId)
  if (!post) return []
  return await getPostSourceAssetsForPost(env, post)
}

export async function getPostAssetIndex(env: WorkerEnv, relativeId: string, index?: PostTreeResponse): Promise<PostAssetIndexResponse | null> {
  const adminIndex = index ?? await getAdminIndex(env)
  const post = adminIndex.posts.find((item) => item.relativeId === relativeId)
  if (!post) return null
  return {
    relativeId: post.relativeId,
    assetIndexPath: post.assetIndexPath,
    assets: await getPostSourceAssetsForPost(env, post),
  }
}
