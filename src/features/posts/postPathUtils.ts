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

  return {
    finalRepoPath: `${paths.assetDir}${filename}`,
    markdownPath: `${paths.markdownAssetPrefix}/${filename}`,
  }
}
