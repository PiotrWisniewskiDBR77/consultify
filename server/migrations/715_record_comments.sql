-- Record-level comments with threading support

CREATE TABLE IF NOT EXISTS tp_record_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES tp_record_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_comments_record ON tp_record_comments(record_id);
CREATE INDEX IF NOT EXISTS idx_tp_comments_table ON tp_record_comments(table_id);
