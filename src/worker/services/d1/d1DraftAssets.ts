import type { DraftAsset, DraftAssetManifest } from '../../../shared/assetTypes'
import type { WorkerEnv } from '../../env'
import { assertSafeImageFilename, assertSafeRelativeId } from '../../utils/pathSafety'
import { buildPostAssetPaths } from '../assets/assetPath'
import { createDraftId, resolveDraftId } from './draftIds'
import { ensureD1Schema } from './d1Schema'

type DraftAssetRow = {
  id: string
  draft_id: string
  relative_id: string
  r2_key: string
  filename: string
  content_type: string
  size: number
  markdown_path: string
  final_repo_path: string
  created_at: string
  updated_at: string
}

type PutDraftAssetOptions = {
  postsDir: string
  draftId?: string
  relativeId: string
  filename: string
  contentType: string
  body: ArrayBuffer
}

type MoveDraftAssetManifestOptions = {
  draftId: string
  relativeId: string
  postsDir: string
}

const db = (env: WorkerEnv) => {
  if (!env.BLOG_ADMIN_DB) throw new Error('BLOG_ADMIN_DB binding is not configured')
  return env.BLOG_ADMIN_DB
}

const bucket = (env: WorkerEnv) => {
  if (!env.BLOG_ASSET_CACHE) throw new Error('BLOG_ASSET_CACHE binding is not configured')
  return env.BLOG_ASSET_CACHE
}

const safeRelativePathSegment = (relativeId: string) => assertSafeRelativeId(relativeId)

const nowIso = () => new Date().toISOString()

export const draftAssetRowToAsset = (row: DraftAssetRow): DraftAsset => ({
  key: row.r2_key,
  draftId: row.draft_id,
  relativeId: row.relative_id,
  filename: row.filename,
  contentType: row.content_type,
  size: row.size,
  createdAt: row.created_at,
  markdownPath: row.markdown_path,
  finalRepoPath: row.final_repo_path,
})

const manifestFromRows = (draftId: string, relativeId: string, rows: DraftAssetRow[]): DraftAssetManifest => ({
  draftId,
  relativeId: rows[0]?.relative_id ?? relativeId,
  assets: rows.map(draftAssetRowToAsset),
  updatedAt: rows.reduce((latest, row) => (row.updated_at > latest ? row.updated_at : latest), rows[0]?.updated_at ?? nowIso()),
})

const putObject = async (env: WorkerEnv, key: string, body: ArrayBuffer, asset: DraftAsset) => {
  await bucket(env).put(key, body, {
    httpMetadata: {
      contentType: asset.contentType,
    },
    customMetadata: {
      draftId: asset.draftId,
      relativeId: asset.relativeId,
      filename: asset.filename,
      markdownPath: asset.markdownPath,
      finalRepoPath: asset.finalRepoPath,
    },
  })
}

async function getAssetRowByKey(env: WorkerEnv, key: string): Promise<DraftAssetRow | null> {
  return (
    (await db(env)
      .prepare(
        `SELECT id, draft_id, relative_id, r2_key, filename, content_type, size, markdown_path, final_repo_path, created_at, updated_at
         FROM draft_assets
         WHERE r2_key = ?1`,
      )
      .bind(key)
      .first<DraftAssetRow>()) ?? null
  )
}

export async function getDraftAssetManifest(
  env: WorkerEnv,
  draftId: string,
  relativeId = draftId,
): Promise<DraftAssetManifest> {
  const result = await db(env)
    .prepare(
      `SELECT id, draft_id, relative_id, r2_key, filename, content_type, size, markdown_path, final_repo_path, created_at, updated_at
       FROM draft_assets
       WHERE draft_id = ?1
       ORDER BY created_at ASC`,
    )
    .bind(draftId)
    .all<DraftAssetRow>()

  return manifestFromRows(draftId, relativeId, result.results ?? [])
}

export async function listDraftAssetManifests(env: WorkerEnv): Promise<DraftAssetManifest[]> {
  const result = await db(env)
    .prepare(
      `SELECT id, draft_id, relative_id, r2_key, filename, content_type, size, markdown_path, final_repo_path, created_at, updated_at
       FROM draft_assets
       ORDER BY updated_at DESC`,
    )
    .all<DraftAssetRow>()

  const groups = new Map<string, DraftAssetRow[]>()
  for (const row of result.results ?? []) {
    groups.set(row.draft_id, [...(groups.get(row.draft_id) ?? []), row])
  }

  return Array.from(groups.entries()).map(([draftId, rows]) => manifestFromRows(draftId, rows[0]?.relative_id ?? draftId, rows))
}

export async function putDraftAsset(env: WorkerEnv, options: PutDraftAssetOptions): Promise<{ asset: DraftAsset; manifest: DraftAssetManifest }> {
  await ensureD1Schema(env)
  const relativeId = assertSafeRelativeId(options.relativeId)
  const requestedDraftId = options.draftId ? resolveDraftId(options.draftId) : ''
  const draftId = requestedDraftId ? assertSafeRelativeId(requestedDraftId) : createDraftId(relativeId)
  const filename = assertSafeImageFilename(options.filename)
  const key = `draft-assets/${safeRelativePathSegment(draftId)}/${crypto.randomUUID()}-${filename}`
  const paths = buildPostAssetPaths({
    postsDir: options.postsDir,
    relativeId,
    filename,
  })
  const now = nowIso()
  await db(env)
    .prepare(
      `INSERT INTO drafts (id, relative_id, title, markdown, created_at, updated_at)
       VALUES (?1, ?2, '', '', ?3, ?3)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(draftId, relativeId, now)
    .run()
  // Uploading an image may happen before the user saves the editor, so create a placeholder draft row.
  const asset: DraftAsset = {
    key,
    draftId,
    relativeId,
    filename,
    contentType: options.contentType || 'application/octet-stream',
    size: options.body.byteLength,
    createdAt: now,
    markdownPath: paths.markdownPath,
    finalRepoPath: paths.finalRepoPath,
  }

  const existing = await db(env)
    .prepare(
      `SELECT id, r2_key
       FROM draft_assets
       WHERE draft_id = ?1 AND markdown_path = ?2
       LIMIT 1`,
    )
    .bind(draftId, asset.markdownPath)
    .first<{ id: string; r2_key: string }>()

  // Re-uploading the same markdown path replaces the old R2 object but preserves one metadata row.
  await putObject(env, key, options.body, asset)
  if (existing) await bucket(env).delete(existing.r2_key)

  if (existing) {
    await db(env)
      .prepare(
        `UPDATE draft_assets
         SET relative_id = ?1,
             r2_key = ?2,
             filename = ?3,
             content_type = ?4,
             size = ?5,
             markdown_path = ?6,
             final_repo_path = ?7,
             updated_at = ?8
         WHERE id = ?9`,
      )
      .bind(relativeId, key, filename, asset.contentType, asset.size, asset.markdownPath, asset.finalRepoPath, now, existing.id)
      .run()
  } else {
    await db(env)
      .prepare(
        `INSERT INTO draft_assets (id, draft_id, relative_id, r2_key, filename, content_type, size, markdown_path, final_repo_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(crypto.randomUUID(), draftId, relativeId, key, filename, asset.contentType, asset.size, asset.markdownPath, asset.finalRepoPath, now, now)
      .run()
  }

  return { asset, manifest: await getDraftAssetManifest(env, draftId, relativeId) }
}

export async function getDraftAsset(env: WorkerEnv, key: string): Promise<R2ObjectBody | null> {
  return (await env.BLOG_ASSET_CACHE?.get(key)) ?? null
}

export async function deleteDraftAsset(env: WorkerEnv, key: string): Promise<{ deleted: boolean }> {
  const row = await getAssetRowByKey(env, key)
  await env.BLOG_ASSET_CACHE?.delete(key)
  if (!row) return { deleted: false }
  await db(env).prepare('DELETE FROM draft_assets WHERE r2_key = ?1').bind(key).run()
  return { deleted: true }
}

export async function renameDraftAsset(
  env: WorkerEnv,
  key: string,
  filename: string,
  postsDir: string,
): Promise<{ asset: DraftAsset; manifest: DraftAssetManifest }> {
  const oldRow = await getAssetRowByKey(env, key)
  if (!oldRow) throw new Error('Asset not found')

  const nextFilename = assertSafeImageFilename(filename)
  const relativeId = assertSafeRelativeId(oldRow.relative_id)
  const paths = buildPostAssetPaths({ postsDir, relativeId, filename: nextFilename })
  const duplicate = await db(env)
    .prepare(
      `SELECT id
       FROM draft_assets
       WHERE draft_id = ?1 AND markdown_path = ?2 AND id <> ?3
       LIMIT 1`,
    )
    .bind(oldRow.draft_id, paths.markdownPath, oldRow.id)
    .first<{ id: string }>()
  if (duplicate) throw new Error('Asset filename already exists')

  const now = nowIso()
  const nextAsset: DraftAsset = {
    ...draftAssetRowToAsset(oldRow),
    filename: nextFilename,
    markdownPath: paths.markdownPath,
    finalRepoPath: paths.finalRepoPath,
  }

  await db(env)
    .prepare(
      `UPDATE draft_assets
       SET filename = ?1,
           markdown_path = ?2,
           final_repo_path = ?3,
           updated_at = ?4
       WHERE id = ?5`,
    )
    .bind(nextFilename, paths.markdownPath, paths.finalRepoPath, now, oldRow.id)
    .run()

  return { asset: nextAsset, manifest: await getDraftAssetManifest(env, oldRow.draft_id, relativeId) }
}

export async function deleteDraftAssets(env: WorkerEnv, options: { keys?: string[]; draftIds?: string[] }): Promise<{ deleted: number }> {
  const keySet = new Set(options.keys ?? [])
  const draftIdSet = new Set(options.draftIds ?? [])
  if (keySet.size === 0 && draftIdSet.size === 0) return { deleted: 0 }

  const conditions: string[] = []
  const values: string[] = []
  if (keySet.size > 0) {
    conditions.push(`r2_key IN (${Array.from(keySet, () => '?').join(', ')})`)
    values.push(...keySet)
  }
  if (draftIdSet.size > 0) {
    conditions.push(`draft_id IN (${Array.from(draftIdSet, () => '?').join(', ')})`)
    values.push(...draftIdSet)
  }

  const rows =
    (
      await db(env)
        .prepare(
          `SELECT id, draft_id, relative_id, r2_key, filename, content_type, size, markdown_path, final_repo_path, created_at, updated_at
           FROM draft_assets
           WHERE ${conditions.join(' OR ')}`,
        )
        .bind(...values)
        .all<DraftAssetRow>()
    ).results ?? []

  await Promise.all(rows.map((row) => env.BLOG_ASSET_CACHE?.delete(row.r2_key)))
  if (rows.length > 0) {
    await db(env)
      .prepare(`DELETE FROM draft_assets WHERE id IN (${rows.map(() => '?').join(', ')})`)
      .bind(...rows.map((row) => row.id))
      .run()
  }

  return { deleted: rows.length }
}

export async function moveDraftAssetManifest(env: WorkerEnv, options: MoveDraftAssetManifestOptions): Promise<DraftAssetManifest> {
  const relativeId = assertSafeRelativeId(options.relativeId)
  const manifest = await getDraftAssetManifest(env, options.draftId, relativeId)
  const now = nowIso()

  // R2 keys are stable draft cache identifiers; relativeId changes only update D1 path mapping.
  await Promise.all(
    manifest.assets.map(async (asset) => {
      const filename = assertSafeImageFilename(asset.filename)
      const paths = buildPostAssetPaths({ postsDir: options.postsDir, relativeId, filename })
      await db(env)
        .prepare(
          `UPDATE draft_assets
           SET relative_id = ?1,
               markdown_path = ?2,
               final_repo_path = ?3,
               updated_at = ?4
           WHERE r2_key = ?5`,
        )
        .bind(relativeId, paths.markdownPath, paths.finalRepoPath, now, asset.key)
        .run()
    }),
  )

  return getDraftAssetManifest(env, options.draftId, relativeId)
}

export async function deleteDraftAssetManifest(env: WorkerEnv, draftId: string): Promise<void> {
  const manifest = await getDraftAssetManifest(env, draftId)
  await Promise.all(manifest.assets.map((asset) => env.BLOG_ASSET_CACHE?.delete(asset.key)))
  await db(env).prepare('DELETE FROM draft_assets WHERE draft_id = ?1').bind(draftId).run()
}
