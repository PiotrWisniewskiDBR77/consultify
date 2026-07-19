-- Migration: 613_results_kpi_report_snapshots.sql
-- Results (V3) — KPI Reports snapshots (R1)
-- Date: 2026-02-28

CREATE TABLE IF NOT EXISTS results_kpi_report_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  period_start TEXT NOT NULL, -- YYYY-MM-DD
  period_end TEXT, -- YYYY-MM-DD
  title TEXT,
  filters_json TEXT, -- JSON (optional)
  snapshot_json TEXT NOT NULL, -- JSON payload (KPI + deviations + action plan)
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_results_kpi_report_snapshots_org_period
  ON results_kpi_report_snapshots(organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_results_kpi_report_snapshots_org_created_at
  ON results_kpi_report_snapshots(organization_id, created_at DESC);

