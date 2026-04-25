CREATE TABLE IF NOT EXISTS wave9_outcomes (
  outcome_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  kpi_name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  baseline REAL NOT NULL,
  target REAL NOT NULL,
  current_value REAL,
  confidence REAL NOT NULL,
  assumptions_json TEXT NOT NULL DEFAULT '[]',
  task_ids_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  compliance_json TEXT NOT NULL DEFAULT '{}',
  roi_json TEXT NOT NULL DEFAULT '{}',
  audit_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave9_provider_health (
  health_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_rate REAL,
  cost_usd REAL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave9_incidents (
  incident_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  rollback_flag TEXT,
  playbook_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave9_acceptance_decisions (
  decision_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  report_json TEXT NOT NULL DEFAULT '{}',
  accepted_limitations_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wave9_outcomes_org
  ON wave9_outcomes(organization_id, initiative_id);

CREATE INDEX IF NOT EXISTS idx_wave9_provider_health_org
  ON wave9_provider_health(organization_id, checked_at);

CREATE INDEX IF NOT EXISTS idx_wave9_acceptance_org
  ON wave9_acceptance_decisions(organization_id, created_at);
