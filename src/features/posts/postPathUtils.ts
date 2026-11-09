export type BuildPostPathsOptions = {
  postsDir: string
  relativeId: string
}

export type PostPaths = {
  folderPath: string
  postSlug: string
  postPath: string
  assetDir: string
  markdownAssetPrefix: string
}

export type BuildPostAssetPathsOptions = BuildPostPathsOptions & {
  filename: string
  /**
   * Optional shared asset directory (repo path, e.g. `source/imgs/posts`).
   * When set, images are stored there instead of the post's own folder, and the
   * markdown path no longer depends on the post location.
   */
  assetDir?: string
  /** Markdown prefix used for shared asset dirs, e.g. `imgs/posts`. */
  markdownPrefix?: string
}

export type PostAssetPaths = {
  finalRepoPath: string
  markdownPath: string
}

const normalizePath = (value: string) =>
  value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')

export function buildPostPaths(options: BuildPostPathsOptions): PostPaths {
  const postsDir = normalizePath(options.postsDir)
  const relativeId = normalizePath(options.relativeId)
  const parts = relativeId.split('/').filter(Boolean)
  const postSlug = parts.at(-1) ?? ''
  const folderPath = parts.slice(0, -1).join('/')
  const postBasePath = [postsDir, folderPath, postSlug].filter(Boolean).join('/')

  return {
    folderPath,
    postSlug,
    postPath: `${postBasePath}.md`,
    assetDir: `${postBasePath}/`,
    markdownAssetPrefix: postSlug,
  }
}

export function buildPostAssetPaths(options: BuildPostAssetPathsOptions): PostAssetPaths {
  const paths = buildPostPaths(options)
  const filename = normalizePath(options.filename).split('/').at(-1) ?? options.filename
  const assetDir = normalizePath(options.assetDir ?? '')
  const sharedPrefix = normalizePath(options.markdownPrefix ?? '')

  if (assetDir) {
    return {
      finalRepoPath: `${assetDir}/${filename}`,
      markdownPath: `${sharedPrefix || assetDir.replace(/^source\//, '')}/${filename}`,
    }
  }

  return {
    finalRepoPath: `${paths.assetDir}${filename}`,
    markdownPath: `${paths.markdownAssetPrefix}/${filename}`,
  }
}
