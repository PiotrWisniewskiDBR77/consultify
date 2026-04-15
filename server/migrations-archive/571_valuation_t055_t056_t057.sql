-- Migration 571 — Bundle 16: Enterprise Valuation (T055–T057)
-- Native PostgreSQL schema for valuation sessions, advisory and negotiation packs.

CREATE TABLE IF NOT EXISTS valuations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  initiative_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED')),
  source_type TEXT NOT NULL CHECK (source_type IN ('financial_model', 'budget', 'manual')),
  source_id TEXT,
  horizon_years INTEGER NOT NULL DEFAULT 5,
  currency TEXT DEFAULT 'PLN',
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  peers JSONB NOT NULL DEFAULT '[]'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  advisory JSONB,
  negotiation_pack JSONB,
  export_path TEXT,
  exported_at TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1,
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_valuations_org ON valuations(organization_id);
CREATE INDEX IF NOT EXISTS idx_valuations_project ON valuations(project_id);
CREATE INDEX IF NOT EXISTS idx_valuations_initiative ON valuations(initiative_id);
CREATE INDEX IF NOT EXISTS idx_valuations_status ON valuations(status);
CREATE INDEX IF NOT EXISTS idx_valuations_source ON valuations(source_type, source_id);

CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  valuation_id TEXT NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_val ON valuation_snapshots(valuation_id, version);
