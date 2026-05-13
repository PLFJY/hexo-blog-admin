import type { WorkerEnv } from '../../env'

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    relative_id TEXT NOT NULL UNIQUE,
    source_relative_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    markdown TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON drafts(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_drafts_relative_id ON drafts(relative_id)',
  `CREATE TABLE IF NOT EXISTS draft_assets (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    relative_id TEXT NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    markdown_path TEXT NOT NULL,
    final_repo_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS idx_draft_assets_draft_id ON draft_assets(draft_id)',
  'CREATE INDEX IF NOT EXISTS idx_draft_assets_relative_id ON draft_assets(relative_id)',
  'CREATE INDEX IF NOT EXISTS idx_draft_assets_updated_at ON draft_assets(updated_at)',
]

let initialization: Promise<void> | undefined

async function ensureColumn(env: WorkerEnv, table: string, column: string, definition: string): Promise<void> {
  const info = await env.BLOG_ADMIN_DB!.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
  if ((info.results ?? []).some((row) => row.name === column)) return
  await env.BLOG_ADMIN_DB!.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run()
}

export async function ensureD1Schema(env: WorkerEnv): Promise<void> {
  if (!env.BLOG_ADMIN_DB) throw new Error('BLOG_ADMIN_DB binding is not configured')
  // Share one in-flight schema initialization per isolate so parallel API requests do not race D1.
  initialization ??= env.BLOG_ADMIN_DB.batch(schemaStatements.map((statement) => env.BLOG_ADMIN_DB!.prepare(statement)))
    .then(async () => {
      await ensureColumn(env, 'drafts', 'source_relative_id', 'source_relative_id TEXT')
      await env.BLOG_ADMIN_DB!.prepare('CREATE INDEX IF NOT EXISTS idx_drafts_source_relative_id ON drafts(source_relative_id)').run()
    })
    .then(() => undefined)
  await initialization
}
