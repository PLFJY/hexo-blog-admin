import type { DraftRecord, SaveDraftRequest } from '../../../shared/draftTypes'
import type { WorkerEnv } from '../../env'

const draftKey = (id: string) => `draft:${id}`

const createId = (relativeId: string) =>
  relativeId
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '-')

export async function listDrafts(env: WorkerEnv): Promise<DraftRecord[]> {
  const list = await env.BLOG_ADMIN_KV?.list({ prefix: 'draft:' })
  if (!list) return []

  const drafts = await Promise.all(
    list.keys.map(async (key) => env.BLOG_ADMIN_KV?.get<DraftRecord>(key.name, 'json')),
  )

  return drafts
    .filter((draft): draft is DraftRecord => Boolean(draft))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getDraft(env: WorkerEnv, id: string): Promise<DraftRecord | null> {
  return (await env.BLOG_ADMIN_KV?.get<DraftRecord>(draftKey(id), 'json')) ?? null
}

export async function saveDraft(env: WorkerEnv, request: SaveDraftRequest, id?: string): Promise<DraftRecord> {
  const now = new Date().toISOString()
  const draftId = id ?? createId(request.relativeId)
  const existing = await getDraft(env, draftId)
  const draft: DraftRecord = {
    id: draftId,
    relativeId: request.relativeId,
    title: request.title,
    markdown: request.markdown,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await env.BLOG_ADMIN_KV?.put(draftKey(draft.id), JSON.stringify(draft))
  return draft
}

export async function deleteDraft(env: WorkerEnv, id: string): Promise<{ deleted: boolean }> {
  await env.BLOG_ADMIN_KV?.delete(draftKey(id))
  return { deleted: true }
}
