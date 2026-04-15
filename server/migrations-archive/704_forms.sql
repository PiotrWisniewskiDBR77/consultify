-- 704_forms.sql — Form builder for Table Platform
-- Creates public-facing forms linked to tp_tables

CREATE TABLE IF NOT EXISTS tp_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  submit_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_forms_table ON tp_forms(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_forms_slug ON tp_forms(slug);
