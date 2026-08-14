-- 952: Agent Hub tenant-scoped runtime capability truth and plan reconciliation.
-- Replay-safe: every object is additive and every constraint replacement is deterministic.

CREATE TABLE IF NOT EXISTS transformation_runtime_capabilities (
  runtime_capability_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lifecycle_stage TEXT NOT NULL,
  capability_key TEXT NOT NULL,
  owner_module TEXT NOT NULL,
  evidence_contract_json JSONB NOT NULL DEFAULT '{"requiredChecks":[]}'::jsonb,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_digest TEXT,
  derived_status TEXT NOT NULL DEFAULT 'EVIDENCE_MISSING'
    CHECK (derived_status IN ('REAL','PARTIAL','BLOCKED','EVIDENCE_MISSING')),
  status_reason TEXT NOT NULL DEFAULT 'No runtime evidence has been reported.',
  observed_at TIMESTAMPTZ,
  registered_by_user_id TEXT NOT NULL REFERENCES users(id),
  updated_by_user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, lifecycle_stage),
  UNIQUE (organization_id, capability_key)
);

CREATE INDEX IF NOT EXISTS idx_transformation_runtime_capabilities_org_status
  ON transformation_runtime_capabilities (organization_id, derived_status, lifecycle_stage);

CREATE TABLE IF NOT EXISTS transformation_capability_reconciliations (
  reconciliation_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transformation_case_id TEXT NOT NULL REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES transformation_plans(plan_id) ON DELETE CASCADE,
  registry_digest TEXT NOT NULL,
  changed_steps INTEGER NOT NULL DEFAULT 0 CHECK (changed_steps >= 0),
  reconciled_by_user_id TEXT NOT NULL REFERENCES users(id),
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, transformation_case_id, plan_id, registry_digest)
);

CREATE INDEX IF NOT EXISTS idx_transformation_capability_reconciliations_case
  ON transformation_capability_reconciliations (organization_id, transformation_case_id, created_at DESC);

-- Preserve explicit runtime truth in the plan; REAL remains impossible without
-- a passing evidence contract enforced by the service transaction.
ALTER TABLE transformation_plan_steps
  DROP CONSTRAINT IF EXISTS transformation_plan_steps_capability_status_check;
ALTER TABLE transformation_plan_steps
  ADD CONSTRAINT transformation_plan_steps_capability_status_check
  CHECK (capability_status IN (
    'REAL','PARTIAL','BLOCKED','EVIDENCE_MISSING',
    'PROPOSAL_ONLY','NOT_CONNECTED','NOT_IMPLEMENTED'
  ));
