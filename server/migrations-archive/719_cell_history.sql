CREATE TABLE IF NOT EXISTS tp_cell_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  field_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_cell_history_record_field ON tp_cell_history(record_id, field_id);
CREATE INDEX IF NOT EXISTS idx_tp_cell_history_table ON tp_cell_history(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_cell_history_changed_at ON tp_cell_history(changed_at);
