-- T01 / U03: canonical Initiative lifecycle gate-decision owner (Variant A).
--
-- This table is intentionally separate from the broad legacy `decisions`
-- aggregate.  Lifecycle gate writers append immutable versions here and the
-- Initiative transition engine reads only the highest version for one
-- (organization, initiative, PMO domain) tuple.  An older APPROVED row can
-- therefore never satisfy a gate after a newer rejection or rebaseline.

CREATE TABLE IF NOT EXISTS initiative_lifecycle_gate_decisions (
  decision_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL REFERENCES initiatives(id),
  transformation_case_id TEXT NOT NULL REFERENCES transformation_cases(transformation_case_id),
  pmo_domain TEXT NOT NULL CHECK (pmo_domain IN (
    'SCHEDULE_MILESTONES',
    'GOVERNANCE_DECISION_MAKING',
    'CLOSURE'
  )),
  version INTEGER NOT NULL CHECK (version >= 1),
  decision_status TEXT NOT NULL CHECK (decision_status IN ('approved','rejected')),
  source_digest TEXT NOT NULL CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  source_case_version INTEGER NOT NULL CHECK (source_case_version >= 1),
  baseline_refs_json JSONB NOT NULL CHECK (
    jsonb_typeof(baseline_refs_json) = 'array'
    AND jsonb_array_length(baseline_refs_json) > 0
  ),
  a05_proposal_version_id TEXT NOT NULL
    REFERENCES v8_agent_proposal_versions(proposal_version_id),
  a05_approval_receipt_ref TEXT NOT NULL
    REFERENCES v8_agent_proposal_scope_reviews(review_id),
  human_actor_user_id TEXT NOT NULL REFERENCES users(id),
  human_authority_ref TEXT NOT NULL,
  rationale TEXT NOT NULL CHECK (length(trim(rationale)) > 0),
  deadline_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'),
  supersedes_decision_id TEXT REFERENCES initiative_lifecycle_gate_decisions(decision_id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, initiative_id, pmo_domain, version),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_initiative_lifecycle_gate_current
  ON initiative_lifecycle_gate_decisions
  (organization_id, initiative_id, pmo_domain, version DESC);

CREATE INDEX IF NOT EXISTS idx_initiative_lifecycle_gate_case
  ON initiative_lifecycle_gate_decisions
  (organization_id, transformation_case_id, source_case_version);

CREATE OR REPLACE FUNCTION reject_initiative_lifecycle_gate_decision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'initiative_lifecycle_gate_decisions are immutable; append a new version'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS initiative_lifecycle_gate_decisions_immutable
  ON initiative_lifecycle_gate_decisions;

CREATE TRIGGER initiative_lifecycle_gate_decisions_immutable
BEFORE UPDATE OR DELETE ON initiative_lifecycle_gate_decisions
FOR EACH ROW EXECUTE FUNCTION reject_initiative_lifecycle_gate_decision_mutation();

-- Forward activation for databases which already applied the original A06
-- catalog migration. Fresh chains also receive the row from that migration.
DO $$
BEGIN
  IF to_regclass('public.v8_tool_catalog') IS NOT NULL
     AND to_regclass('public.organizations') IS NOT NULL THEN
    INSERT INTO v8_tool_catalog
      (tool_id,organization_id,name,description,category,risk_class,mutation_type,
       classification_status,default_approval_mode,classified_by,classified_at,
       version,created_at,updated_at)
    SELECT 'a06-t01:' || o.id || ':transformation:initiative_lifecycle:transition',
           o.id,'transformation.initiative_lifecycle.transition',
           'Apply an approved canonical Initiative lifecycle transition',
           'workflow_action','high_risk','workflow_mutation','ratified',
           'policy_approvable','system:t01-lifecycle-gate',CURRENT_TIMESTAMP,
           '1.0.0',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      FROM organizations o
    ON CONFLICT (tool_id) DO NOTHING;
  END IF;

  IF to_regclass('public.v8_consumer_tool_policies') IS NOT NULL
     AND to_regclass('public.v8_tool_catalog') IS NOT NULL THEN
    INSERT INTO v8_consumer_tool_policies
      (policy_id,organization_id,project_id,consumer_class,tool_id,allowed,
       approval_override,max_invocations_per_run,effective_from,created_at,updated_at)
    SELECT 'a06-t01-policy:' || organization_id || ':transformation:initiative_lifecycle:transition',
           organization_id,NULL,'execution',tool_id,1,'force_policy_gate',64,
           CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      FROM v8_tool_catalog
     WHERE name='transformation.initiative_lifecycle.transition'
    ON CONFLICT (policy_id) DO NOTHING;
  END IF;
END $$;
