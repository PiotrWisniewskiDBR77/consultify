-- EXE-BVP-001 / EXE-MVP-ACTIONS-001
-- Additive Initiative -> Case execution receipt, approved delivery evidence,
-- exactly-once Results signal outbox, and governed action registry/audit.

CREATE TABLE IF NOT EXISTS execution_case_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  initiative_id TEXT NOT NULL REFERENCES initiatives(id),
  case_id TEXT NOT NULL REFERENCES case_core(case_id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  intake_idempotency_key TEXT NOT NULL,
  work_ref TEXT,
  resource_ref TEXT,
  control_ref TEXT,
  report_ref TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, initiative_id),
  UNIQUE (organization_id, case_id),
  UNIQUE (organization_id, intake_idempotency_key)
);

CREATE TABLE IF NOT EXISTS execution_delivery_evidence (
  evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  execution_link_id UUID NOT NULL REFERENCES execution_case_links(link_id),
  artifact_link_id TEXT NOT NULL REFERENCES case_workspace_artifact_links(link_id),
  artifact_revision TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (approval_status IN ('SUBMITTED','APPROVED','REJECTED')),
  submitted_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (execution_link_id, artifact_link_id, artifact_revision)
);

CREATE TABLE IF NOT EXISTS execution_results_signal_outbox (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  execution_link_id UUID NOT NULL REFERENCES execution_case_links(link_id),
  initiative_id TEXT NOT NULL REFERENCES initiatives(id),
  case_id TEXT NOT NULL REFERENCES case_core(case_id),
  evidence_id UUID NOT NULL REFERENCES execution_delivery_evidence(evidence_id),
  signal_type TEXT NOT NULL DEFAULT 'EXECUTION_DELIVERY_APPROVED',
  payload_version INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING','DELIVERED','FAILED')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  UNIQUE (organization_id, case_id, signal_type),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS execution_action_registry (
  action_id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  destructive BOOLEAN NOT NULL,
  minimum_role TEXT NOT NULL CHECK (minimum_role IN ('MEMBER','ADMIN','OWNER')),
  runtime_state TEXT NOT NULL CHECK (runtime_state IN ('IMPLEMENTED','HIDDEN')),
  audit_required BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO execution_action_registry
  (action_id,target_type,destructive,minimum_role,runtime_state,audit_required)
VALUES
  ('case.close','case',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.cancel','case',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.wait.cancel','wait',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.run.cancel','run',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.artifact.unlink','artifact_link',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.proposal.decide','action_proposal',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.proposal.execute','action_proposal',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('case.proposal.revoke','action_proposal',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('execution.budget.delete','budget_entry',TRUE,'ADMIN','IMPLEMENTED',TRUE),
  ('execution.initiative.archive','initiative',TRUE,'ADMIN','HIDDEN',TRUE),
  ('execution.initiative.delete','initiative',TRUE,'OWNER','HIDDEN',TRUE),
  ('execution.report.edit','report',FALSE,'MEMBER','HIDDEN',TRUE),
  ('execution.report.archive','report',TRUE,'ADMIN','HIDDEN',TRUE)
ON CONFLICT (action_id) DO UPDATE SET
  target_type = EXCLUDED.target_type,
  destructive = EXCLUDED.destructive,
  minimum_role = EXCLUDED.minimum_role,
  runtime_state = EXCLUDED.runtime_state,
  audit_required = EXCLUDED.audit_required,
  updated_at = now();

CREATE TABLE IF NOT EXISTS execution_action_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  action_id TEXT NOT NULL REFERENCES execution_action_registry(action_id),
  target_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED','DENIED','NOT_FOUND','CONFLICT')),
  reason_code TEXT,
  request_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_results_signal_pending
  ON execution_results_signal_outbox(delivery_status, created_at);
CREATE INDEX IF NOT EXISTS idx_execution_action_audit_org_time
  ON execution_action_audit(organization_id, occurred_at DESC);

