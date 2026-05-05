import type { DraftAsset, DraftAssetManifest } from '../../../shared/assetTypes'
import type { WorkerEnv } from '../../env'
import { assertSafeImageFilename, assertSafeRelativeId } from '../../utils/pathSafety'
import { buildPostAssetPaths } from './assetPath'
import { createDraftId } from '../kv/kvDrafts'

const manifestKey = (draftId: string) => `draft-assets:${draftId}`

const safeRelativePathSegment = (relativeId: string) => assertSafeRelativeId(relativeId)

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
  if (!env.BLOG_ADMIN_KV) {
    throw new Error('BLOG_ADMIN_KV binding is not configured')
  }
  const updated = { ...manifest, updatedAt: new Date().toISOString() }
  await env.BLOG_ADMIN_KV.put(manifestKey(manifest.draftId), JSON.stringify(updated))
  return updated
}

export async function listDraftAssetManifests(env: WorkerEnv): Promise<DraftAssetManifest[]> {
  const list = await env.BLOG_ADMIN_KV?.list({ prefix: 'draft-assets:' })
  if (!list) return []
  const manifests = await Promise.all(list.keys.map((item) => env.BLOG_ADMIN_KV?.get<DraftAssetManifest>(item.name, 'json')))
  return manifests.filter((manifest): manifest is DraftAssetManifest => Boolean(manifest))
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
  if (!env.BLOG_ASSET_CACHE) {
    throw new Error('BLOG_ASSET_CACHE binding is not configured')
  }
  const relativeId = assertSafeRelativeId(options.relativeId)
  const draftId = createDraftId(relativeId)
  const filename = assertSafeImageFilename(options.filename)
  const key = `draft-assets/${safeRelativePathSegment(relativeId)}/${draftId}/${crypto.randomUUID()}-${filename}`
  const paths = buildPostAssetPaths({
    postsDir: options.postsDir,
    relativeId,
    filename,
  })
  const asset: DraftAsset = {
    key,
    draftId,
    relativeId,
    filename,
    contentType: options.contentType || 'application/octet-stream',
    size: options.body.byteLength,
    createdAt: new Date().toISOString(),
    markdownPath: paths.markdownPath,
    finalRepoPath: paths.finalRepoPath,
  }
  await env.BLOG_ASSET_CACHE.put(key, options.body, {
    httpMetadata: {
      contentType: asset.contentType,
    },
    customMetadata: {
      draftId,
      relativeId,
      filename,
      markdownPath: asset.markdownPath,
      finalRepoPath: asset.finalRepoPath,
    },
  })
  const manifest = await getDraftAssetManifest(env, draftId, relativeId)
  const nextManifest = await saveManifest(env, {
    ...manifest,
    relativeId,
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

export async function renameDraftAsset(
  env: WorkerEnv,
  key: string,
  filename: string,
  postsDir: string,
): Promise<{ asset: DraftAsset; manifest: DraftAssetManifest }> {
  if (!env.BLOG_ASSET_CACHE) throw new Error('BLOG_ASSET_CACHE binding is not configured')
  const manifests = await listDraftAssetManifests(env)
  const manifest = manifests.find((item) => item.assets.some((asset) => asset.key === key))
  const oldAsset = manifest?.assets.find((asset) => asset.key === key)
  if (!manifest || !oldAsset) throw new Error('Asset not found')

  const object = await env.BLOG_ASSET_CACHE.get(key)
  if (!object) throw new Error('Asset object not found')

  const nextFilename = assertSafeImageFilename(filename)
  const relativeId = assertSafeRelativeId(oldAsset.relativeId)
  const randomPrefix = key.split('/').at(-1)?.split('-').at(0) || crypto.randomUUID()
  const nextKey = `draft-assets/${safeRelativePathSegment(relativeId)}/${oldAsset.draftId}/${randomPrefix}-${nextFilename}`
  const paths = buildPostAssetPaths({ postsDir, relativeId, filename: nextFilename })
  const nextAsset: DraftAsset = {
    ...oldAsset,
    key: nextKey,
    filename: nextFilename,
    markdownPath: paths.markdownPath,
    finalRepoPath: paths.finalRepoPath,
  }

  await env.BLOG_ASSET_CACHE.put(nextKey, await object.arrayBuffer(), {
    httpMetadata: { contentType: nextAsset.contentType },
    customMetadata: {
      draftId: nextAsset.draftId,
      relativeId: nextAsset.relativeId,
      filename: nextAsset.filename,
      markdownPath: nextAsset.markdownPath,
      finalRepoPath: nextAsset.finalRepoPath,
    },
  })
  await env.BLOG_ASSET_CACHE.delete(key)
  const nextManifest = await saveManifest(env, {
    ...manifest,
    assets: manifest.assets.map((asset) => (asset.key === key ? nextAsset : asset)),
  })
  return { asset: nextAsset, manifest: nextManifest }
}

export async function deleteDraftAssets(env: WorkerEnv, options: { keys?: string[]; draftIds?: string[] }): Promise<{ deleted: number }> {
  const keySet = new Set(options.keys ?? [])
  const draftIdSet = new Set(options.draftIds ?? [])
  const manifests = await listDraftAssetManifests(env)
  let deleted = 0
  await Promise.all(
    manifests.map(async (manifest) => {
      const selected = manifest.assets.filter((asset) => keySet.has(asset.key) || draftIdSet.has(asset.draftId))
      if (selected.length === 0) return
      await Promise.all(selected.map((asset) => env.BLOG_ASSET_CACHE?.delete(asset.key)))
      deleted += selected.length
      const remaining = manifest.assets.filter((asset) => !selected.some((item) => item.key === asset.key))
      if (remaining.length === 0 || draftIdSet.has(manifest.draftId)) {
        await env.BLOG_ADMIN_KV?.delete(manifestKey(manifest.draftId))
        return
      }
      await saveManifest(env, { ...manifest, assets: remaining })
    }),
  )
  return { deleted }
}

export async function moveDraftAssetManifest(
  env: WorkerEnv,
  options: {
    draftId: string
    relativeId: string
    postsDir: string
  },
): Promise<DraftAssetManifest> {
  if (!env.BLOG_ASSET_CACHE) throw new Error('BLOG_ASSET_CACHE binding is not configured')
  const manifest = await getDraftAssetManifest(env, options.draftId, options.relativeId)
  const relativeId = assertSafeRelativeId(options.relativeId)
  const nextAssets = await Promise.all(
    manifest.assets.map(async (asset) => {
      const object = await env.BLOG_ASSET_CACHE?.get(asset.key)
      const filename = assertSafeImageFilename(asset.filename)
      const nextKey = `draft-assets/${safeRelativePathSegment(relativeId)}/${options.draftId}/${crypto.randomUUID()}-${filename}`
      const paths = buildPostAssetPaths({ postsDir: options.postsDir, relativeId, filename })
      const nextAsset: DraftAsset = {
        ...asset,
        key: nextKey,
        draftId: options.draftId,
        relativeId,
        markdownPath: paths.markdownPath,
        finalRepoPath: paths.finalRepoPath,
      }
      if (object) {
        await env.BLOG_ASSET_CACHE?.put(nextKey, await object.arrayBuffer(), {
          httpMetadata: { contentType: nextAsset.contentType },
          customMetadata: {
            draftId: nextAsset.draftId,
            relativeId: nextAsset.relativeId,
            filename: nextAsset.filename,
            markdownPath: nextAsset.markdownPath,
            finalRepoPath: nextAsset.finalRepoPath,
          },
        })
        await env.BLOG_ASSET_CACHE?.delete(asset.key)
      }
      return nextAsset
    }),
  )
  return saveManifest(env, {
    ...manifest,
    relativeId,
    assets: nextAssets,
  })
}

export async function deleteDraftAssetManifest(env: WorkerEnv, draftId: string): Promise<void> {
  const manifest = await getDraftAssetManifest(env, draftId)
  await Promise.all(manifest.assets.map((asset) => env.BLOG_ASSET_CACHE?.delete(asset.key)))
  await env.BLOG_ADMIN_KV?.delete(manifestKey(draftId))
}
