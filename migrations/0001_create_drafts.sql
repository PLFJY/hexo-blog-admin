PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  relative_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  markdown TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON drafts(updated_at);
CREATE INDEX IF NOT EXISTS idx_drafts_relative_id ON drafts(relative_id);

CREATE TABLE IF NOT EXISTS draft_assets (
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
);

CREATE INDEX IF NOT EXISTS idx_draft_assets_draft_id ON draft_assets(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_assets_relative_id ON draft_assets(relative_id);
CREATE INDEX IF NOT EXISTS idx_draft_assets_updated_at ON draft_assets(updated_at);
