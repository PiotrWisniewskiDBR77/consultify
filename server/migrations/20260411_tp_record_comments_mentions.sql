-- Optional @mention handles stored with record comments (JSON array of strings)
CREATE TABLE IF NOT EXISTS tp_record_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  record_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  author_user_id TEXT,
  author_name TEXT,
  content TEXT NOT NULL,
  parent_id TEXT REFERENCES tp_record_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_comments_record ON tp_record_comments(record_id);
CREATE INDEX IF NOT EXISTS idx_tp_comments_table ON tp_record_comments(table_id);

ALTER TABLE tp_record_comments
  ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
