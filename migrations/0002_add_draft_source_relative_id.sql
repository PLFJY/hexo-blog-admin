ALTER TABLE drafts ADD COLUMN source_relative_id TEXT;
CREATE INDEX IF NOT EXISTS idx_drafts_source_relative_id ON drafts(source_relative_id);
