CREATE TABLE IF NOT EXISTS tp_row_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  condition_field_id UUID REFERENCES tp_fields(id),
  condition_operator TEXT NOT NULL DEFAULT 'equals',
  condition_value TEXT,
  permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write', 'none')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tp_row_policies_table ON tp_row_policies(table_id);
