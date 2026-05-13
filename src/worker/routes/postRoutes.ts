import type { PostContentResponse, TogglePostPublishedRequest, TogglePostPublishedResponse } from '../../shared/postTypes'
import type { WorkerEnv } from '../env'
import { buildPostAssetPaths, buildPostPaths } from '../../features/posts/postPathUtils'
import { setFrontMatterBoolean } from '../../shared/frontMatter'
import { removeMarkdownImageReferences } from '../../shared/markdownAssets'
import { getGitHubFile, getGitHubFileBase64 } from '../services/github/githubContent'
import { createBatchCommit } from '../services/github/githubGitCommit'
import { getAdminIndex } from '../services/indexer/adminIndex'
import { getPostAssetIndex, getPostSourceAssets } from '../services/indexer/postAssetIndex'
import { requireConfig } from '../utils/config'
import { assertSafeImageFilename, assertSafeRelativeId, assertSafeRepoPath } from '../utils/pathSafety'
import { json } from '../utils/response'

type RenamePostAssetRequest = {
  relativeId?: string
  repoPath?: string
  filename?: string
  markdown?: string
}

type DeletePostAssetRequest = {
  relativeId?: string
  repoPath?: string
  markdownPath?: string
  markdown?: string
}

type RenamePostRequest = {
  relativeId?: string
  newRelativeId?: string
  markdown?: string
}

type DeletePostRequest = {
  relativeId?: string
}

type TogglePostPublishedBody = Partial<TogglePostPublishedRequest>

export async function handlePostsTree(env: WorkerEnv): Promise<Response> {
  return json(await getAdminIndex(env))
}

const contentTypeFromPath = (repoPath: string) => {
  const ext = repoPath.split('.').at(-1)?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'avif') return 'image/avif'
  return 'application/octet-stream'
}

export async function handlePostAssetBlob(env: WorkerEnv, request: Request): Promise<Response> {
  const repoPath = new URL(request.url).searchParams.get('repoPath')
  if (!repoPath) return json({ error: 'BAD_REQUEST', message: 'repoPath is required' }, { status: 400 })
  const safeRepoPath = assertSafeRepoPath(env, repoPath)
  const file = await getGitHubFileBase64(env, safeRepoPath)
  const binary = atob(file.contentBase64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new Response(bytes, {
    headers: {
      'content-type': contentTypeFromPath(safeRepoPath),
      'cache-control': 'private, max-age=300',
    },
  })
}

export async function handlePostAssets(env: WorkerEnv, request: Request): Promise<Response> {
  const relativeIdParam = new URL(request.url).searchParams.get('relativeId')
  if (!relativeIdParam) return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })
  const relativeId = assertSafeRelativeId(relativeIdParam)
  const response = await getPostAssetIndex(env, relativeId)
  if (!response) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })
  return json(response)
}

const replaceAll = (value: string, from: string, to: string) => value.split(from).join(to)

export async function handleRenamePostAsset(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = (await request.json()) as RenamePostAssetRequest
  if (!body.relativeId || !body.repoPath || !body.filename) {
    return json({ error: 'BAD_REQUEST', message: 'relativeId, repoPath and filename are required' }, { status: 400 })
  }
  const relativeId = assertSafeRelativeId(body.relativeId)
  const oldRepoPath = assertSafeRepoPath(env, body.repoPath)
  const filename = assertSafeImageFilename(body.filename)
  const config = requireConfig(env)
  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })
  const sourceAssets = await getPostSourceAssets(env, relativeId, index)
  const asset = sourceAssets.find((item) => item.repoPath === oldRepoPath)
  if (!asset) return json({ error: 'NOT_FOUND', message: 'Asset not found in admin-index' }, { status: 404 })

  const paths = buildPostAssetPaths({ postsDir: config.POSTS_DIR, relativeId, filename })
  const duplicate = sourceAssets.some((item) => item.repoPath !== oldRepoPath && (item.repoPath === paths.finalRepoPath || item.markdownPath === paths.markdownPath))
  if (duplicate) return json({ error: 'CONFLICT', message: 'Asset filename already exists' }, { status: 409 })

  const image = await getGitHubFileBase64(env, oldRepoPath)
  const markdown = replaceAll(body.markdown ?? (await getGitHubFile(env, post.path).then((file) => file.content)), asset.markdownPath, paths.markdownPath)
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `Rename asset ${asset.filename} to ${filename}`,
    files: [
      { path: post.path, encoding: 'utf-8', content: markdown },
      { path: paths.finalRepoPath, encoding: 'base64', content: image.contentBase64 },
    ],
    deletions: [oldRepoPath],
  })

  return json({
    commitSha: commit.commitSha,
    markdown,
    asset: {
      filename,
      repoPath: paths.finalRepoPath,
      markdownPath: paths.markdownPath,
      size: asset.size,
    },
  })
}

export async function handleDeletePostAsset(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = (await request.json()) as DeletePostAssetRequest
  if (!body.relativeId || !body.repoPath || !body.markdownPath) {
    return json({ error: 'BAD_REQUEST', message: 'relativeId, repoPath and markdownPath are required' }, { status: 400 })
  }
  const relativeId = assertSafeRelativeId(body.relativeId)
  const repoPath = assertSafeRepoPath(env, body.repoPath)
  const config = requireConfig(env)
  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })
  const sourceAssets = await getPostSourceAssets(env, relativeId, index)
  const asset = sourceAssets.find((item) => item.repoPath === repoPath || item.markdownPath === body.markdownPath)
  if (!asset) return json({ error: 'NOT_FOUND', message: 'Asset not found in admin-index' }, { status: 404 })
  const markdown = removeMarkdownImageReferences(body.markdown ?? (await getGitHubFile(env, post.path).then((file) => file.content)), asset.markdownPath)
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `Delete asset ${asset.markdownPath}`,
    files: [{ path: post.path, encoding: 'utf-8', content: markdown }],
    deletions: [repoPath],
  })
  return json({ commitSha: commit.commitSha, markdown })
}

export async function handleRenamePost(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = (await request.json()) as RenamePostRequest
  if (!body.relativeId || !body.newRelativeId) {
    return json({ error: 'BAD_REQUEST', message: 'relativeId and newRelativeId are required' }, { status: 400 })
  }
  const relativeId = assertSafeRelativeId(body.relativeId)
  const newRelativeId = assertSafeRelativeId(body.newRelativeId)
  const config = requireConfig(env)
  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })
  const sourceAssets = await getPostSourceAssets(env, relativeId, index)

  const oldPaths = buildPostPaths({ postsDir: config.POSTS_DIR, relativeId })
  const newPaths = buildPostPaths({ postsDir: config.POSTS_DIR, relativeId: newRelativeId })
  const currentMarkdown = body.markdown ?? (await getGitHubFile(env, post.path || oldPaths.postPath).then((file) => file.content))
  const markdown = replaceAll(currentMarkdown, `${oldPaths.postSlug}/`, `${newPaths.postSlug}/`)
  const assetFiles = await Promise.all(
    sourceAssets.map(async (asset) => {
      const filename = assertSafeImageFilename(asset.filename)
      const image = await getGitHubFileBase64(env, assertSafeRepoPath(env, asset.repoPath))
      const paths = buildPostAssetPaths({ postsDir: config.POSTS_DIR, relativeId: newRelativeId, filename })
      return { path: paths.finalRepoPath, encoding: 'base64' as const, content: image.contentBase64 }
    }),
  )
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `Rename post ${relativeId} to ${newRelativeId}`,
    files: [
      { path: newPaths.postPath, encoding: 'utf-8', content: markdown },
      ...assetFiles,
    ],
    deletions: [post.path || oldPaths.postPath, ...sourceAssets.map((asset) => assertSafeRepoPath(env, asset.repoPath))],
  })

  return json({ commitSha: commit.commitSha, relativeId: newRelativeId, markdown })
}

export async function handleDeletePost(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = (await request.json()) as DeletePostRequest
  if (!body.relativeId) return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })
  const relativeId = assertSafeRelativeId(body.relativeId)
  const config = requireConfig(env)
  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })
  const sourceAssets = await getPostSourceAssets(env, relativeId, index)
  const paths = buildPostPaths({ postsDir: config.POSTS_DIR, relativeId })
  const deletions = [post.path || paths.postPath, ...sourceAssets.map((asset) => assertSafeRepoPath(env, asset.repoPath))]
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `Delete post ${relativeId}`,
    files: [],
    deletions,
  })
  return json({ commitSha: commit.commitSha, relativeId })
}

export async function handleTogglePostPublished(env: WorkerEnv, request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  const body = (await request.json()) as TogglePostPublishedBody
  if (!body.relativeId || typeof body.published !== 'boolean') {
    return json({ error: 'BAD_REQUEST', message: 'relativeId and published are required' }, { status: 400 })
  }
  const relativeId = assertSafeRelativeId(body.relativeId)
  const config = requireConfig(env)
  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })

  const fallbackPath = buildPostPaths({ postsDir: config.POSTS_DIR, relativeId }).postPath
  const path = post.path || fallbackPath
  const currentMarkdown = await getGitHubFile(env, path).then((file) => file.content)
  const markdown = setFrontMatterBoolean(currentMarkdown, 'published', body.published)
  const commit = await createBatchCommit(env, {
    branch: config.GITHUB_BRANCH,
    message: `${body.published ? 'Publish' : 'Unpublish'} post ${relativeId}`,
    files: [{ path, encoding: 'utf-8', content: markdown }],
  })

  const response: TogglePostPublishedResponse = {
    commitSha: commit.commitSha,
    relativeId,
    published: body.published,
    markdown,
  }
  return json(response)
}

export async function handlePostContent(env: WorkerEnv, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const relativeId = url.searchParams.get('relativeId')
  if (!relativeId) return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })

  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })

  const fallbackPath = buildPostPaths({
    postsDir: requireConfig(env).POSTS_DIR,
    relativeId,
  }).postPath
  const file = await getGitHubFile(env, post.path || fallbackPath)
  const response: PostContentResponse = {
    post,
    markdown: file.content,
    sha: file.sha,
  }

  return json(response)
}
