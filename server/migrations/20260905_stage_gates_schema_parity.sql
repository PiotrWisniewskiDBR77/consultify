-- Canonical stageGateService and StageGateController both read/write this
-- lifecycle ledger, but a fresh migrated database previously had no producer.

CREATE TABLE IF NOT EXISTS stage_gates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL,
  from_phase TEXT,
  to_phase TEXT,
  status TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stage_gates_project_approved
  ON stage_gates (project_id, approved_at DESC);
