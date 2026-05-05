import type { DraftAsset, DraftAssetManifest } from '../../../shared/assetTypes'
import type { WorkerEnv } from '../../env'
import { buildPostAssetPaths } from './assetPath'
import { createDraftId } from '../kv/kvDrafts'

const manifestKey = (draftId: string) => `draft-assets:${draftId}`
const normalizeFilename = (filename: string) =>
  filename
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '-')
    || 'asset'

export async function getDraftAssetManifest(
  env: WorkerEnv,
  draftId: string,
  relativeId = draftId,
): Promise<DraftAssetManifest> {
  const manifest = await env.BLOG_ADMIN_KV?.get<DraftAssetManifest>(manifestKey(draftId), 'json')
  return manifest ?? {
    draftId,
    relativeId,
    assets: [],
    updatedAt: new Date().toISOString(),
  }
}

async function saveManifest(env: WorkerEnv, manifest: DraftAssetManifest) {
  const updated = { ...manifest, updatedAt: new Date().toISOString() }
  await env.BLOG_ADMIN_KV?.put(manifestKey(manifest.draftId), JSON.stringify(updated))
  return updated
}

export async function putDraftAsset(
  env: WorkerEnv,
  options: {
    postsDir: string
    relativeId: string
    filename: string
    contentType: string
    body: ArrayBuffer
  },
): Promise<{ asset: DraftAsset; manifest: DraftAssetManifest }> {
  const draftId = createDraftId(options.relativeId)
  const filename = normalizeFilename(options.filename)
  const key = `draft-assets/${draftId}/${crypto.randomUUID()}-${filename}`
  const paths = buildPostAssetPaths({
    postsDir: options.postsDir,
    relativeId: options.relativeId,
    filename,
  })
  const asset: DraftAsset = {
    key,
    draftId,
    relativeId: options.relativeId,
    filename,
    contentType: options.contentType || 'application/octet-stream',
    size: options.body.byteLength,
    createdAt: new Date().toISOString(),
    markdownPath: paths.markdownPath,
    finalRepoPath: paths.finalRepoPath,
  }
  await env.BLOG_ASSET_CACHE?.put(key, options.body, {
    httpMetadata: {
      contentType: asset.contentType,
    },
    customMetadata: {
      draftId,
      relativeId: options.relativeId,
      filename,
      markdownPath: asset.markdownPath,
      finalRepoPath: asset.finalRepoPath,
    },
  })
  const manifest = await getDraftAssetManifest(env, draftId, options.relativeId)
  const nextManifest = await saveManifest(env, {
    ...manifest,
    relativeId: options.relativeId,
    assets: [...manifest.assets.filter((item) => item.markdownPath !== asset.markdownPath), asset],
  })

  return { asset, manifest: nextManifest }
}

export async function getDraftAsset(env: WorkerEnv, key: string): Promise<R2ObjectBody | null> {
  return (await env.BLOG_ASSET_CACHE?.get(key)) ?? null
}

export async function deleteDraftAsset(env: WorkerEnv, key: string): Promise<{ deleted: boolean }> {
  const manifests = await env.BLOG_ADMIN_KV?.list({ prefix: 'draft-assets:' })
  const targetManifest = manifests
    ? (await Promise.all(
        manifests.keys.map(async (item) => env.BLOG_ADMIN_KV?.get<DraftAssetManifest>(item.name, 'json')),
      )).find((manifest) => manifest?.assets.some((asset) => asset.key === key))
    : undefined

  await env.BLOG_ASSET_CACHE?.delete(key)
  if (targetManifest) {
    await saveManifest(env, {
      ...targetManifest,
      assets: targetManifest.assets.filter((asset) => asset.key !== key),
    })
  }
  return { deleted: true }
}

export async function deleteDraftAssetManifest(env: WorkerEnv, draftId: string): Promise<void> {
  const manifest = await getDraftAssetManifest(env, draftId)
  await Promise.all(manifest.assets.map((asset) => env.BLOG_ASSET_CACHE?.delete(asset.key)))
  await env.BLOG_ADMIN_KV?.delete(manifestKey(draftId))
}
