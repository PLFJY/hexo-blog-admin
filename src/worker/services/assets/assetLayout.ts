import type { WorkerEnv } from '../../env'

/**
 * Draft image layout configuration.
 *
 * Default (no `POST_ASSET_DIR`): Hexo post-asset-folder style, images land in
 * `POSTS_DIR/<folder>/<slug>/<file>` and markdown uses `<slug>/<file>`.
 *
 * Shared dir (`POST_ASSET_DIR=source/imgs/posts`): every image lands in that one
 * repo directory and markdown uses `POST_ASSET_MARKDOWN_PREFIX/<file>`
 * (default derives from the dir, `source/imgs/posts` -> `imgs/posts`).
 *
 * `POST_ASSET_NAMING=sequential` renames uploads to the next free integer
 * (1.png, 2.png, ...) to match a numeric image folder; the default keeps the
 * uploaded filename and only de-duplicates on collision.
 */
export type AssetLayout = {
  assetDir?: string
  markdownPrefix?: string
}

export type AssetNaming = 'original' | 'sequential'

const normalizePath = (value: string) =>
  value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')

export function resolveAssetLayout(env: WorkerEnv): AssetLayout {
  const assetDir = normalizePath(env.POST_ASSET_DIR ?? '')
  if (!assetDir) return {}

  const markdownPrefix =
    normalizePath(env.POST_ASSET_MARKDOWN_PREFIX ?? '') || assetDir.replace(/^source\//, '')

  return { assetDir, markdownPrefix }
}

export function hasSharedAssetDir(env: WorkerEnv): boolean {
  return Boolean(normalizePath(env.POST_ASSET_DIR ?? ''))
}

export function resolveAssetNaming(env: WorkerEnv): AssetNaming {
  return (env.POST_ASSET_NAMING ?? '').trim().toLowerCase() === 'sequential' ? 'sequential' : 'original'
}

export function splitFilename(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return { base: filename, ext: '' }
  return { base: filename.slice(0, dot), ext: filename.slice(dot) }
}

/** Next integer name that is not taken, matching a numeric image folder. */
export function nextSequentialFilename(taken: Iterable<string>, ext: string): string {
  let max = 0
  for (const name of taken) {
    const stem = splitFilename(name).base
    if (/^\d+$/.test(stem)) max = Math.max(max, Number(stem))
  }
  const used = new Set(taken)
  let next = max + 1
  while (used.has(`${next}${ext}`)) next += 1
  return `${next}${ext}`
}

/** Keep the requested name, appending `-2`, `-3`, ... until it is free. */
export function dedupeFilename(taken: Iterable<string>, filename: string): string {
  const used = new Set(taken)
  if (!used.has(filename)) return filename
  const { base, ext } = splitFilename(filename)
  let index = 2
  while (used.has(`${base}-${index}${ext}`)) index += 1
  return `${base}-${index}${ext}`
}
