-- M16/3.4: Frozen Baseline & Value Ledger.
-- value_baselines  = immutable frozen snapshot of a KPI value at a point in time
--                    (only one is_active=1 per org+initiative+kpi).
-- value_ledger_entries = append-only, auditable corrections/deltas applied on top
--                    of the active baseline, each carrying provenance.
-- Current value of a KPI = active baseline.frozen_value + Σ ledger.value_delta.

CREATE TABLE IF NOT EXISTS value_baselines (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT NOT NULL,
  kpi_id          TEXT NOT NULL,
  frozen_value    REAL NOT NULL DEFAULT 0,
  frozen_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  frozen_by       TEXT,
  source_snapshot TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS value_ledger_entries (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT NOT NULL,
  entry_type      TEXT NOT NULL,
  value_delta     REAL NOT NULL DEFAULT 0,
  reason          TEXT,
  provenance      TEXT,
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_value_baselines_active
  ON value_baselines(organization_id, initiative_id, kpi_id, is_active);
CREATE INDEX IF NOT EXISTS idx_value_baselines_org
  ON value_baselines(organization_id);
CREATE INDEX IF NOT EXISTS idx_value_ledger_entries_initiative
  ON value_ledger_entries(organization_id, initiative_id, created_at);
CREATE INDEX IF NOT EXISTS idx_value_ledger_entries_org
  ON value_ledger_entries(organization_id);
