CREATE TABLE IF NOT EXISTS financial_statement_packs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  entity_name TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT,
  currency TEXT DEFAULT 'PLN',
  scaling TEXT DEFAULT 'units' CHECK (scaling IN ('units', 'thousands', 'millions', 'billions')),
  pack_status TEXT DEFAULT 'draft' CHECK (pack_status IN ('draft', 'partial', 'ready', 'confirmed', 'needs_review', 'archived')),
  pack_readiness_status TEXT DEFAULT 'pending' CHECK (pack_readiness_status IN ('pending', 'recoverable', 'ready', 'rejected')),
  pack_readiness_score REAL DEFAULT 0,
  pack_quality_summary TEXT,
  pack_quality_reason_codes TEXT,
  source_statement_count INTEGER DEFAULT 0,
  missing_statement_types TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsp_org ON financial_statement_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_fsp_period ON financial_statement_packs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_fsp_status ON financial_statement_packs(pack_status, pack_readiness_status);

ALTER TABLE financial_statements
  ADD COLUMN IF NOT EXISTS statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fs_pack_id ON financial_statements(statement_pack_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fs_pack_active_type
  ON financial_statements(statement_pack_id, statement_type)
  WHERE statement_pack_id IS NOT NULL AND COALESCE(status, 'draft') <> 'archived';

ALTER TABLE financial_models
  ADD COLUMN IF NOT EXISTS source_statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fm_source_pack ON financial_models(source_statement_pack_id);

ALTER TABLE financial_analyses
  ADD COLUMN IF NOT EXISTS source_statement_pack_id TEXT REFERENCES financial_statement_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fa_source_pack ON financial_analyses(source_statement_pack_id);
