export type DraftAsset = {
  key: string
  filename: string
  contentType: string
  size: number
  createdAt: string
}

export type DraftAssetManifest = {
  draftId: string
  relativeId: string
  assets: DraftAsset[]
  updatedAt: string
}
