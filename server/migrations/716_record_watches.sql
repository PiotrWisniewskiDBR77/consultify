-- Record watch/subscribe for change notifications

CREATE TABLE IF NOT EXISTS tp_record_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(record_id, user_id)
);

CREATE INDEX idx_tp_watches_record ON tp_record_watches(record_id);
CREATE INDEX idx_tp_watches_user ON tp_record_watches(user_id);
