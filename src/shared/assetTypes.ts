export type DraftAsset = {
  key: string
  draftId: string
  relativeId: string
  filename: string
  contentType: string
  size: number
  createdAt: string
  markdownPath: string
  finalRepoPath: string
}

export type DraftAssetManifest = {
  draftId: string
  relativeId: string
  assets: DraftAsset[]
  updatedAt: string
}

export type DraftAssetListResponse = {
  manifest: DraftAssetManifest
}

export type DraftAssetUploadResponse = {
  asset: DraftAsset
  manifest: DraftAssetManifest
}

export type ImageWarehouseSourceAsset = {
  kind: 'source'
  filename: string
  repoPath: string
  markdownPath: string
  size?: number
  publicUrl?: string
}

export type ImageWarehouseTempAsset = DraftAsset & {
  kind: 'temp'
}

export type ImageWarehouseAsset = ImageWarehouseSourceAsset | ImageWarehouseTempAsset

export type RenameDraftAssetResponse = {
  asset: DraftAsset
  manifest: DraftAssetManifest
}

export type AssetCacheGroup = {
  draftId: string
  relativeId: string
  assets: DraftAsset[]
  count: number
  totalSize: number
  updatedAt: string
}

export type AssetCacheListResponse = {
  groups: AssetCacheGroup[]
}

export type DeleteAssetCacheRequest = {
  keys?: string[]
  draftIds?: string[]
}

export type DeleteAssetCacheResponse = {
  deleted: number
}
