import type { DraftRecord, SaveDraftRequest } from '../../../shared/draftTypes'
import { extractFrontMatterTitle } from '../../../shared/frontMatter'
import type { WorkerEnv } from '../../env'
import { deleteDraftAssetManifest } from './d1DraftAssets'
import { ensureD1Schema } from './d1Schema'
import { createDraftId, isValidRelativeId, normalizeRelativeId, resolveDraftId, visibleDraftId } from './draftIds'

type DraftRow = {
  id: string
  relative_id: string
  source_relative_id?: string | null
  title: string
  markdown: string
  created_at: string
  updated_at: string
}

const db = (env: WorkerEnv) => {
  if (!env.BLOG_ADMIN_DB) throw new Error('BLOG_ADMIN_DB binding is not configured')
  return env.BLOG_ADMIN_DB
}

export { createDraftId, isValidRelativeId } from './draftIds'

export const draftRowToRecord = (row: DraftRow): DraftRecord => ({
  id: visibleDraftId(row.id),
  relativeId: row.relative_id,
  sourceRelativeId: row.source_relative_id ?? undefined,
  title: row.title,
  markdown: row.markdown,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function listDrafts(env: WorkerEnv): Promise<DraftRecord[]> {
  await ensureD1Schema(env)
  const result = await db(env)
    .prepare(
      `SELECT id, relative_id, source_relative_id, title, markdown, created_at, updated_at
       FROM drafts
       ORDER BY updated_at DESC`,
    )
    .all<DraftRow>()

  return (result.results ?? []).map(draftRowToRecord)
}

export async function getDraft(env: WorkerEnv, id: string): Promise<DraftRecord | null> {
  await ensureD1Schema(env)
  const row = await db(env)
    .prepare(
      `SELECT id, relative_id, source_relative_id, title, markdown, created_at, updated_at
       FROM drafts
       WHERE id = ?1`,
    )
    .bind(resolveDraftId(id))
    .first<DraftRow>()

  return row ? draftRowToRecord(row) : null
}

export async function saveDraft(env: WorkerEnv, request: SaveDraftRequest, id?: string): Promise<DraftRecord> {
  await ensureD1Schema(env)
  if (!isValidRelativeId(request.relativeId)) {
    throw new Error('Invalid relativeId')
  }
  if (request.sourceRelativeId && !isValidRelativeId(request.sourceRelativeId)) {
    throw new Error('Invalid sourceRelativeId')
  }

  const now = new Date().toISOString()
  const relativeId = normalizeRelativeId(request.relativeId)
  const draftId = createDraftId(relativeId)
  const previousDraftId = id && resolveDraftId(id) ? resolveDraftId(id) : ''
  const existing = previousDraftId ? await getDraft(env, previousDraftId) : await getDraft(env, draftId)
  const sourceRelativeId = request.sourceRelativeId ? normalizeRelativeId(request.sourceRelativeId) : existing?.sourceRelativeId
  const title = extractFrontMatterTitle(request.markdown)
  const createdAt = existing?.createdAt ?? now

  try {
    if (previousDraftId && previousDraftId !== draftId) {
      const duplicate = await getDraft(env, draftId)
      if (duplicate) throw new Error(`Draft relativeId already exists: ${relativeId}`)
      await db(env).batch([
        db(env)
          .prepare(
            `INSERT INTO drafts (id, relative_id, source_relative_id, title, markdown, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(draftId, relativeId, sourceRelativeId ?? null, title, request.markdown, createdAt, now),
        db(env)
          .prepare('UPDATE draft_assets SET draft_id = ?1, updated_at = ?2 WHERE draft_id = ?3')
          .bind(draftId, now, previousDraftId),
        db(env).prepare('DELETE FROM drafts WHERE id = ?1').bind(previousDraftId),
      ])
    } else {
      await db(env)
        .prepare(
      `INSERT INTO drafts (id, relative_id, source_relative_id, title, markdown, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           relative_id = excluded.relative_id,
           source_relative_id = excluded.source_relative_id,
           title = excluded.title,
           markdown = excluded.markdown,
           updated_at = excluded.updated_at`,
        )
        .bind(draftId, relativeId, sourceRelativeId ?? null, title, request.markdown, createdAt, now)
        .run()
    }
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('unique')) {
      throw new Error(`Draft relativeId already exists: ${relativeId}`, { cause: error })
    }
    throw error
  }

  return {
    id: draftId,
    relativeId,
    sourceRelativeId,
    title,
    markdown: request.markdown,
    createdAt,
    updatedAt: now,
  }
}

export async function deleteDraft(env: WorkerEnv, id: string): Promise<{ deleted: boolean }> {
  const draftId = resolveDraftId(id)
  await deleteDraftAssetManifest(env, draftId)
  const result = await db(env).prepare('DELETE FROM drafts WHERE id = ?1').bind(draftId).run()
  return { deleted: (result.meta?.changes ?? 0) > 0 }
}
