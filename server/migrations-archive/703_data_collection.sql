-- 703_data_collection.sql
-- Data Collection layer: connectors, run log, record provenance

-- Connector configurations
CREATE TABLE IF NOT EXISTS tp_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  target_table_id UUID REFERENCES tp_tables(id) ON DELETE SET NULL,
  field_mapping JSONB NOT NULL DEFAULT '[]',
  schedule JSONB,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connectors_workspace ON tp_connectors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connectors_org ON tp_connectors(organization_id);

-- Connector run log
CREATE TABLE IF NOT EXISTS tp_connector_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES tp_connectors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  records_fetched INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_connector_runs_connector ON tp_connector_runs(connector_id, started_at DESC);

-- Record provenance
CREATE TABLE IF NOT EXISTS tp_record_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  connector_id UUID REFERENCES tp_connectors(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_metadata JSONB DEFAULT '{}',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provenance_record ON tp_record_provenance(record_id);
CREATE INDEX IF NOT EXISTS idx_provenance_connector ON tp_record_provenance(connector_id);
