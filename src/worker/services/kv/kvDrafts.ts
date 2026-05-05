import type { DraftRecord, SaveDraftRequest } from '../../../shared/draftTypes'
import { extractFrontMatterTitle } from '../../../shared/frontMatter'
import type { WorkerEnv } from '../../env'

const draftKey = (id: string) => `draft:${id}`
const emptyDraftId = '__empty-draft-id__'

const normalizeRelativeId = (relativeId: string) =>
  relativeId
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/')

const resolveDraftId = (id: string) => (id === emptyDraftId ? '' : id)

export const isValidRelativeId = (relativeId: string) => {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized) return false
  if (normalized.startsWith('.') || normalized.includes('..')) return false
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git')) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(normalized)
}

export const createDraftId = (relativeId: string) =>
  normalizeRelativeId(relativeId).replace(/[^a-zA-Z0-9/_-]/g, '-')

export async function listDrafts(env: WorkerEnv): Promise<DraftRecord[]> {
  const list = await env.BLOG_ADMIN_KV?.list({ prefix: 'draft:' })
  if (!list) return []

  const drafts = await Promise.all(
    list.keys.map(async (key) => {
      const draft = await env.BLOG_ADMIN_KV?.get<DraftRecord>(key.name, 'json')
      if (!draft) return null
      return draft.id ? draft : { ...draft, id: emptyDraftId }
    }),
  )

  return drafts
    .filter((draft): draft is DraftRecord => Boolean(draft))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getDraft(env: WorkerEnv, id: string): Promise<DraftRecord | null> {
  return (await env.BLOG_ADMIN_KV?.get<DraftRecord>(draftKey(resolveDraftId(id)), 'json')) ?? null
}

export async function saveDraft(env: WorkerEnv, request: SaveDraftRequest, id?: string): Promise<DraftRecord> {
  if (!isValidRelativeId(request.relativeId)) {
    throw new Error('Invalid relativeId')
  }

  const now = new Date().toISOString()
  const draftId = id && id !== emptyDraftId ? id : createDraftId(request.relativeId)
  const existing = await getDraft(env, draftId)
  const relativeId = normalizeRelativeId(request.relativeId)
  const draft: DraftRecord = {
    id: draftId,
    relativeId,
    title: extractFrontMatterTitle(request.markdown),
    markdown: request.markdown,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await env.BLOG_ADMIN_KV?.put(draftKey(draft.id), JSON.stringify(draft))
  return draft
}

export async function deleteDraft(env: WorkerEnv, id: string): Promise<{ deleted: boolean }> {
  await env.BLOG_ADMIN_KV?.delete(draftKey(resolveDraftId(id)))
  return { deleted: true }
}
