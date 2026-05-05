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
