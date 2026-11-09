import type { PostAsset, PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'
import { getPostSourceAssetsForPost } from '../indexer/postAssetIndex'
import { listGitHubDirNames } from '../github/githubContent'
import { hasSharedAssetDir, resolveAssetLayout } from './assetLayout'

/**
 * Helpers for shared asset directories (`POST_ASSET_DIR`).
 *
 * A shared dir holds images for many posts at once, so an image may be used by
 * more than one post: deletes have to prove nobody else needs the file, and
 * renames have to look at the whole directory instead of a single post.
 */

export class AssetNameTakenError extends Error {
  constructor(filename: string) {
    super(`Asset filename already exists: ${filename}`)
    this.name = 'AssetNameTakenError'
  }
}

/** Shard lookups fan out over every post; keep the fan-out bounded. */
const LOOKUP_CONCURRENCY = 6
/** Above this many posts we refuse to guess and keep the files instead. */
const MAX_POST_LOOKUPS = 60

/** Names of draft images already staged in D1 for a shared asset dir. */
export async function listStagedFilenames(
  env: WorkerEnv,
  assetDir: string,
  excludeDraftIds: string[] = [],
): Promise<Set<string>> {
  if (!env.BLOG_ADMIN_DB) return new Set()

  const excluded = new Set(excludeDraftIds.filter(Boolean))
  const result = await env.BLOG_ADMIN_DB.prepare(
    'SELECT draft_id, final_repo_path FROM draft_assets WHERE final_repo_path LIKE ?1',
  )
    .bind(`${assetDir}/%`)
    .all<{ draft_id: string; final_repo_path: string }>()

  const prefix = `${assetDir}/`
  const names = new Set<string>()
  for (const row of result.results ?? []) {
    if (excluded.has(row.draft_id)) continue
    const name = row.final_repo_path.slice(prefix.length)
    if (name && !name.includes('/')) names.add(name)
  }
  return names
}

/**
 * Filenames used by posts other than the excluded ones.
 * Returns `null` when the answer cannot be determined (too many posts to scan),
 * which callers must treat as "in use" so nothing is deleted by accident.
 */
export async function referencedFilenamesElsewhere(
  env: WorkerEnv,
  index: PostTreeResponse,
  excludedRelativeIds: string[],
): Promise<Set<string> | null> {
  const excluded = new Set(excludedRelativeIds)
  const posts = (index.posts ?? []).filter((post) => !excluded.has(post.relativeId))
  if (posts.length > MAX_POST_LOOKUPS) return null

  const names = new Set<string>()
  for (let offset = 0; offset < posts.length; offset += LOOKUP_CONCURRENCY) {
    const chunk = posts.slice(offset, offset + LOOKUP_CONCURRENCY)
    const results = await Promise.all(chunk.map((post) => getPostSourceAssetsForPost(env, post)))
    for (const assets of results) {
      for (const asset of assets) names.add(asset.filename)
    }
  }
  return names
}

/**
 * Images of a post that are safe to delete with it.
 *
 * Per-post asset folders (`post_asset_folder: true`) own their images, so all of
 * them go. In a shared dir an image is only removed when no other post references
 * it and no draft has it staged; when that cannot be verified the image is kept
 * (an orphan file is harmless, a missing image is not).
 */
export async function sharedAssetsSafeToDelete(
  env: WorkerEnv,
  index: PostTreeResponse,
  postsAssets: PostAsset[],
  excludedRelativeIds: string[],
): Promise<PostAsset[]> {
  if (!hasSharedAssetDir(env)) return postsAssets
  if (postsAssets.length === 0) return postsAssets

  const layout = resolveAssetLayout(env)
  const referenced = await referencedFilenamesElsewhere(env, index, excludedRelativeIds)
  if (referenced === null) return []

  const staged = layout.assetDir ? await listStagedFilenames(env, layout.assetDir) : new Set<string>()
  return postsAssets.filter((asset) => !referenced.has(asset.filename) && !staged.has(asset.filename))
}

/** Whether `filename` is already used inside the shared asset dir. */
export async function isSharedAssetNameTaken(
  env: WorkerEnv,
  filename: string,
  options: { publishedNames?: string[]; excludeKeys?: string[] } = {},
): Promise<boolean> {
  const layout = resolveAssetLayout(env)
  if (!layout.assetDir) return false

  const published = options.publishedNames ?? (await listGitHubDirNames(env, layout.assetDir))
  if (published.includes(filename)) return true

  const staged = await listStagedFilenames(env, layout.assetDir, options.excludeKeys)
  return staged.has(filename)
}
