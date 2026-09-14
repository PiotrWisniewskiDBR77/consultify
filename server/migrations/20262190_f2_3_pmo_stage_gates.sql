-- F2-3 PMO E3: durable PMBOK-lite project stage-gate history.
-- Additive only. Gate sign-offs and quorum remain in the canonical
-- initiatives/execution governance engine; this table stores the accepted
-- project transition and its exact governance receipt.

CREATE TABLE IF NOT EXISTS stage_gates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL CHECK (
    gate_type IN (
      'READINESS_GATE',
      'DESIGN_GATE',
      'PLANNING_GATE',
      'EXECUTION_GATE',
      'CLOSURE_GATE'
    )
  ),
  from_phase TEXT,
  to_phase TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASSED', 'REJECTED')),
  decision_id TEXT,
  policy_id TEXT,
  policy_version INTEGER CHECK (policy_version IS NULL OR policy_version >= 1),
  quorum_id TEXT,
  quorum_version INTEGER CHECK (quorum_version IS NULL OR quorum_version >= 1),
  quorum_receipt_id TEXT,
  requested_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stage_gates_org_project_history
  ON stage_gates (organization_id, project_id, approved_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_gates_org_project_type_status
  ON stage_gates (organization_id, project_id, gate_type, status);
