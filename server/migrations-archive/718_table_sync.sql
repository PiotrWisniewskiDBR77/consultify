CREATE TABLE IF NOT EXISTS tp_table_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  target_table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  field_mapping JSONB NOT NULL DEFAULT '{}',
  sync_mode TEXT NOT NULL DEFAULT 'one_way' CHECK (sync_mode IN ('one_way', 'two_way')),
  filter_config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_table_id, target_table_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_syncs_source ON tp_table_syncs(source_table_id);
CREATE INDEX IF NOT EXISTS idx_tp_syncs_target ON tp_table_syncs(target_table_id);
