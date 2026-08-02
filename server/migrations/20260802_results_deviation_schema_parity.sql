-- Results deviation schema parity for fresh PostgreSQL environments.
-- The original definition lived only in migrations/never-ran and in the
-- monolithic baseline-gap dump. This additive migration makes the active
-- deviation/recovery runtime independently deployable.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS baseline_value REAL,
  ADD COLUMN IF NOT EXISTS current_value REAL,
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'HIGHER_IS_BETTER',
  ADD COLUMN IF NOT EXISTS threshold_mode TEXT DEFAULT 'PERCENT_FROM_TARGET',
  ADD COLUMN IF NOT EXISTS amber_threshold_pct REAL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS red_threshold_pct REAL DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS amber_threshold_abs REAL,
  ADD COLUMN IF NOT EXISTS red_threshold_abs REAL;

ALTER TABLE initiative_kpis ALTER COLUMN initiative_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS kpi_deviation_cases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_id TEXT NOT NULL REFERENCES initiative_kpis(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE,
  severity TEXT NOT NULL CHECK (severity IN ('AMBER', 'RED')),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'MITIGATING', 'RESOLVED', 'CLOSED')),
  owner_user_id TEXT,
  deviation_summary TEXT,
  rca_text TEXT,
  detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  detected_by TEXT DEFAULT 'system',
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  evidence_text TEXT,
  evidence_ref TEXT,
  closed_by TEXT,
  resolution_notes TEXT,
  linked_initiative_id TEXT,
  linked_task_id TEXT,
  UNIQUE (organization_id, kpi_id, period_start)
);

ALTER TABLE kpi_deviation_cases
  ADD COLUMN IF NOT EXISTS evidence_text TEXT,
  ADD COLUMN IF NOT EXISTS evidence_ref TEXT,
  ADD COLUMN IF NOT EXISTS closed_by TEXT,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS linked_initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_task_id TEXT;

CREATE TABLE IF NOT EXISTS kpi_deviation_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id TEXT NOT NULL REFERENCES kpi_deviation_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_user_id TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_org ON kpi_deviation_cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_kpi ON kpi_deviation_cases(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_status ON kpi_deviation_cases(status);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_cases_period ON kpi_deviation_cases(period_start);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_actions_case ON kpi_deviation_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_kpi_dev_actions_status ON kpi_deviation_actions(status);
