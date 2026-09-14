export type DraftRecord = {
  id: string
  relativeId: string
  sourceRelativeId?: string
  title: string
  markdown: string
  createdAt?: string
  updatedAt: string
}

export type DraftListResponse = {
  drafts: DraftRecord[]
}

export type SaveDraftRequest = {
  relativeId: string
  sourceRelativeId?: string
  title: string
  markdown: string
}

export type PublishDraftRequest = {
  draftId: string
  message?: string
  branch?: string
}

export type PublishDraftResponse = {
  commitSha: string
  relativeId: string
}

export type BatchDraftAction = 'delete'

export type BatchDraftsRequest = {
  draftIds: string[]
  action: BatchDraftAction
}

export type BatchDraftsResponse = {
  deleted: number
  draftIds: string[]
}
