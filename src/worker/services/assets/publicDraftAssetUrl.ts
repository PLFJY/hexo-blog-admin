import type { DraftAsset, DraftAssetManifest, DraftAssetUploadResponse } from '../../../shared/assetTypes'
import type { WorkerEnv } from '../../env'

const encodeR2KeyForUrl = (key: string) => key.split('/').map((part) => encodeURIComponent(part)).join('/')

export function buildDraftAssetPublicUrl(env: WorkerEnv, key: string) {
  const base = env.BLOG_ASSET_PUBLIC_URL?.trim().replace(/\/+$/g, '')
  if (!base) return undefined
  return `${base}/${encodeR2KeyForUrl(key)}`
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

export function withDraftAssetUploadPublicUrls(env: WorkerEnv, response: DraftAssetUploadResponse): DraftAssetUploadResponse {
  return {
    asset: withDraftAssetPublicUrl(env, response.asset),
    manifest: withDraftAssetManifestPublicUrls(env, response.manifest),
  }
}
