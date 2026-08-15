-- RED-SCOPE (2026-07-19): create the scope-change ledger required by
-- aiRiskChangeControl and steering-report generation.
--
-- The sibling risk_register migration already documents this missing table.
-- Keep is_controlled as INTEGER because the current callers write and filter
-- 0/1 values and the SQL adapter does not rewrite this column to booleans.

CREATE TABLE IF NOT EXISTS scope_change_log (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL,
  organization_id  TEXT,
  entity_type      TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  change_type      TEXT NOT NULL,
  change_summary   TEXT,
  field_changed    TEXT,
  previous_value   TEXT,
  new_value        TEXT,
  is_controlled    INTEGER NOT NULL DEFAULT 0,
  change_reason    TEXT,
  changed_by       TEXT,
  approved_by      TEXT,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scope_change_log_project
  ON scope_change_log(project_id);
CREATE INDEX IF NOT EXISTS idx_scope_change_log_org
  ON scope_change_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_scope_change_log_changed_at
  ON scope_change_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_scope_change_log_controlled
  ON scope_change_log(is_controlled);

