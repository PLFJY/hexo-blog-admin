import type { DraftAsset, DraftAssetManifest } from '../../../shared/assetTypes'
import type { WorkerEnv } from '../../env'

export function buildDraftAssetPublicUrl(env: WorkerEnv, key: string): string | undefined {
  const base = env.BLOG_ASSET_PUBLIC_URL?.trim().replace(/\/+$/g, '')
  if (!base) return undefined

  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `${base}/${encodedKey}`
}

export function withDraftAssetPublicUrl(env: WorkerEnv, asset: DraftAsset): DraftAsset {
  const publicUrl = buildDraftAssetPublicUrl(env, asset.key)
  return publicUrl ? { ...asset, publicUrl } : asset
}

export function withDraftAssetManifestPublicUrls(env: WorkerEnv, manifest: DraftAssetManifest): DraftAssetManifest {
  return {
    ...manifest,
    assets: manifest.assets.map((asset) => withDraftAssetPublicUrl(env, asset)),
  }
}

export function withDraftAssetMutationPublicUrls<T extends { asset: DraftAsset; manifest: DraftAssetManifest }>(
  env: WorkerEnv,
  response: T,
): T {
  return {
    ...response,
    asset: withDraftAssetPublicUrl(env, response.asset),
    manifest: withDraftAssetManifestPublicUrls(env, response.manifest),
  }
}
