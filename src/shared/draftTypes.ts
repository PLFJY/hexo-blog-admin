export type DraftRecord = {
  id: string
  relativeId: string
  title: string
  markdown: string
  updatedAt: string
}

export type DraftListResponse = {
  drafts: DraftRecord[]
}
