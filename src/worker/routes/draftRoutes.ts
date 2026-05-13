import type { DraftListResponse, PublishDraftRequest, PublishDraftResponse, SaveDraftRequest } from '../../shared/draftTypes'
import { ensureFrontMatterDate, extractFrontMatterTitle } from '../../shared/frontMatter'
import type { WorkerEnv } from '../env'
import { buildPostAssetPaths, buildPostPaths } from '../../features/posts/postPathUtils'
import { getDraftAsset, getDraftAssetManifest, moveDraftAssetManifest } from '../services/d1/d1DraftAssets'
import { createBatchCommit } from '../services/github/githubGitCommit'
import { getGitHubFileBase64 } from '../services/github/githubContent'
import { getAdminIndex } from '../services/indexer/adminIndex'
import { getPostSourceAssets } from '../services/indexer/postAssetIndex'
import { deleteDraft, getDraft, isValidRelativeId, listDrafts, saveDraft } from '../services/d1/d1Drafts'
import { requireConfig } from '../utils/config'
import { assertSafeImageFilename, assertSafeRepoPath } from '../utils/pathSafety'
import { json } from '../utils/response'

const replaceMarkdownAssetPrefix = (markdown: string, oldRelativeId: string, newRelativeId: string) => {
  const oldSlug = buildPostPaths({ postsDir: '', relativeId: oldRelativeId }).postSlug
  const newSlug = buildPostPaths({ postsDir: '', relativeId: newRelativeId }).postSlug
  if (!oldSlug || !newSlug || oldSlug === newSlug) return markdown
  return markdown.split(`${oldSlug}/`).join(`${newSlug}/`)
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export async function handleDrafts(env: WorkerEnv): Promise<Response> {
  const response: DraftListResponse = {
    drafts: await listDrafts(env),
  }

  return json(response)
}

export async function handleCreateDraft(env: WorkerEnv, request: Request): Promise<Response> {
  const body = (await request.json()) as SaveDraftRequest
  if (!isValidRelativeId(body.relativeId)) {
    return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })
  }
  return json(await saveDraft(env, { ...body, markdown: ensureFrontMatterDate(body.markdown) }), { status: 201 })
}

export async function handleDraftById(env: WorkerEnv, request: Request, id: string): Promise<Response> {
  if (request.method === 'GET') {
    const draft = await getDraft(env, id)
    return draft ? json(draft) : json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  if (request.method === 'PUT') {
    const body = (await request.json()) as SaveDraftRequest
    if (!isValidRelativeId(body.relativeId)) {
      return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })
    }
    const existing = await getDraft(env, id)
    const config = requireConfig(env)
    const markdown =
      existing && existing.relativeId !== body.relativeId
        ? replaceMarkdownAssetPrefix(body.markdown, existing.relativeId, body.relativeId)
        : body.markdown
    const draft = await saveDraft(env, { ...body, markdown }, id)
    if (existing && existing.relativeId !== draft.relativeId) {
      await moveDraftAssetManifest(env, {
        draftId: draft.id,
        relativeId: draft.relativeId,
        postsDir: config.POSTS_DIR,
      })
    }
    return json(draft)
  }

  if (request.method === 'DELETE') {
    return json(await deleteDraft(env, id))
  }

  return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
}

export async function handlePublishDraft(env: WorkerEnv, request: Request): Promise<Response> {
  const body = (await request.json()) as PublishDraftRequest
  const draft = await getDraft(env, body.draftId)
  if (!draft) return json({ error: 'NOT_FOUND', message: 'Draft not found' }, { status: 404 })
  if (!isValidRelativeId(draft.relativeId)) {
    return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })
  }

  const config = requireConfig(env)
  const paths = buildPostPaths({
    postsDir: config.POSTS_DIR,
    relativeId: draft.relativeId,
  })
  const markdown = ensureFrontMatterDate(draft.markdown)
  const sourceRelativeId = draft.sourceRelativeId && isValidRelativeId(draft.sourceRelativeId) ? draft.sourceRelativeId : undefined
  const sourceRename = Boolean(sourceRelativeId && sourceRelativeId !== draft.relativeId)
  const index = sourceRelativeId ? await getAdminIndex(env) : undefined
  const sourcePost = sourceRelativeId ? index?.posts.find((item) => item.relativeId === sourceRelativeId) : undefined
  const sourceAssets = sourcePost && index ? await getPostSourceAssets(env, sourceRelativeId!, index) : []
  const draftManifest = await getDraftAssetManifest(env, draft.id, draft.relativeId)
  const draftAssetFiles = (await Promise.all(
    draftManifest.assets.map(async (asset) => {
      const object = await getDraftAsset(env, asset.key)
      if (!object) return undefined
      return {
        path: asset.finalRepoPath,
        encoding: 'base64' as const,
        content: arrayBufferToBase64(await object.arrayBuffer()),
      }
    }),
  )).filter((file): file is { path: string; encoding: 'base64'; content: string } => Boolean(file))
  const draftAssetPaths = new Set(draftAssetFiles.map((file) => file.path))
  const sourceAssetFiles = sourceRename
    ? (await Promise.all(
        sourceAssets.map(async (asset) => {
          const filename = assertSafeImageFilename(asset.filename)
          const assetPaths = buildPostAssetPaths({ postsDir: config.POSTS_DIR, relativeId: draft.relativeId, filename })
          if (draftAssetPaths.has(assetPaths.finalRepoPath)) return undefined
          const image = await getGitHubFileBase64(env, assertSafeRepoPath(env, asset.repoPath))
          return {
            path: assetPaths.finalRepoPath,
            encoding: 'base64' as const,
            content: image.contentBase64,
          }
        }),
      )).filter((file): file is { path: string; encoding: 'base64'; content: string } => Boolean(file))
    : []
  const oldSourcePaths = sourceRename && sourcePost
    ? [sourcePost.path || buildPostPaths({ postsDir: config.POSTS_DIR, relativeId: sourceRelativeId! }).postPath, ...sourceAssets.map((asset) => assertSafeRepoPath(env, asset.repoPath))]
    : []
  const commit = await createBatchCommit(env, {
    branch: body.branch || config.GITHUB_BRANCH,
    message: body.message || (sourceRename ? `Rename post ${sourceRelativeId} to ${draft.relativeId}` : `Publish ${extractFrontMatterTitle(markdown) || draft.relativeId}`),
    files: [
      {
        path: paths.postPath,
        encoding: 'utf-8',
        content: markdown,
      },
      ...sourceAssetFiles,
      ...draftAssetFiles,
    ],
    deletions: oldSourcePaths,
  })
  await deleteDraft(env, draft.id)

  const response: PublishDraftResponse = {
    commitSha: commit.commitSha,
    relativeId: draft.relativeId,
  }
  return json(response)
}
