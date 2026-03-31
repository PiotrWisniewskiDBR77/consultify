-- P05-B: Finance lane runs, mutation audit, version snapshots (bounded E2E lane)

CREATE TABLE IF NOT EXISTS v8_finance_lane_runs (
  run_id               TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL,
  current_step         TEXT NOT NULL
                       CHECK (current_step IN ('import', 'analysis', 'mutation', 'readback')),
  import_outcome       TEXT,
  analysis_completed   INTEGER NOT NULL DEFAULT 0,
  mutation_outcome     TEXT,
  readback_confirmed   INTEGER NOT NULL DEFAULT 0,
  degraded_json        TEXT NOT NULL DEFAULT '[]',
  audit_trail_json     TEXT NOT NULL DEFAULT '[]',
  version_type         TEXT NOT NULL DEFAULT 'current'
                       CHECK (version_type IN ('current', 'actual')),
  kpi_linkage_status   TEXT NOT NULL DEFAULT 'coherent'
                       CHECK (kpi_linkage_status IN ('coherent', 'stale', 'unavailable')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_finance_lane_runs_org_created
  ON v8_finance_lane_runs(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v8_finance_mutation_audit (
  audit_id         TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  run_id           TEXT NOT NULL,
  mutation_type    TEXT NOT NULL,
  target_entity    TEXT NOT NULL,
  previous_value   TEXT,
  new_value        TEXT NOT NULL,
  outcome          TEXT NOT NULL
                   CHECK (outcome IN ('applied', 'failed', 'conflict', 'rolled_back')),
  actor            TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_finance_mutation_audit_org_run
  ON v8_finance_mutation_audit(organization_id, run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v8_finance_version_snapshots (
  snapshot_id      TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  version_type     TEXT NOT NULL
                   CHECK (version_type IN ('current', 'actual')),
  snapshot_data    TEXT NOT NULL,
  switchover_date  TEXT,
  switchover_actor TEXT,
  is_finalized     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_finance_version_snapshots_org_type
  ON v8_finance_version_snapshots(organization_id, version_type, created_at DESC);
