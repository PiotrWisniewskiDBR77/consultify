-- EPIC-AGENT-T01 / T01-I01
-- Durable transformation identity and reviewable plan proposal.

CREATE TABLE IF NOT EXISTS transformation_cases (
  transformation_case_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  conversation_id TEXT,
  context_snapshot_id TEXT,
  execution_run_id TEXT,
  initiated_by_user_id TEXT NOT NULL,
  mandate TEXT NOT NULL CHECK (length(trim(mandate)) > 0),
  desired_outcomes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'plan_proposed', 'plan_approved', 'active', 'cancelled')),
  lifecycle_stage TEXT NOT NULL DEFAULT 'mandate'
    CHECK (lifecycle_stage IN ('mandate', 'discovery', 'initial_ideas', 'interviews', 'drd', 'opportunity_synthesis', 'initiative_candidates', 'finance_kpi', 'portfolio_decision', 'mobilization', 'execution', 'delivery', 'benefits', 'sustainability', 'final_outputs')),
  autonomy_level TEXT NOT NULL DEFAULT 'A1_prepare'
    CHECK (autonomy_level = 'A1_prepare'),
  source_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_plan_id TEXT,
  lineage_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT transformation_cases_org_idempotency_uq
    UNIQUE (organization_id, idempotency_key)
);

-- Safe when an earlier draft of this migration was already applied locally.
ALTER TABLE transformation_cases
  ADD COLUMN IF NOT EXISTS context_snapshot_id TEXT;
ALTER TABLE transformation_cases
  ADD COLUMN IF NOT EXISTS execution_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transformation_cases_org_status
  ON transformation_cases (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_transformation_cases_project
  ON transformation_cases (organization_id, project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transformation_cases_conversation
  ON transformation_cases (organization_id, conversation_id)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transformation_cases_execution_run
  ON transformation_cases (organization_id, execution_run_id)
  WHERE execution_run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transformation_cases_lineage
  ON transformation_cases (organization_id, lineage_id);

CREATE TABLE IF NOT EXISTS transformation_plans (
  plan_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('draft', 'proposed', 'pending_review', 'approved', 'cancelled')),
  methodology_key TEXT NOT NULL DEFAULT 'consultify-transformation-v1',
  summary TEXT NOT NULL,
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transformation_plans_case_version_uq
    UNIQUE (transformation_case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_transformation_plans_case
  ON transformation_plans (organization_id, transformation_case_id, version DESC);

CREATE TABLE IF NOT EXISTS transformation_plan_steps (
  step_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES transformation_plans(plan_id) ON DELETE CASCADE,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  lifecycle_stage TEXT NOT NULL,
  business_purpose TEXT NOT NULL,
  module_target TEXT NOT NULL,
  capability_status TEXT NOT NULL
    CHECK (capability_status IN ('REAL', 'PARTIAL', 'PROPOSAL_ONLY', 'NOT_CONNECTED', 'NOT_IMPLEMENTED')),
  inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  outputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_role TEXT NOT NULL,
  depends_on_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_class TEXT NOT NULL
    CHECK (approval_class IN ('none', 'policy_approvable', 'requires_human_approval')),
  risk_class TEXT NOT NULL
    CHECK (risk_class IN ('read_only', 'safe_additive', 'safe_update', 'sensitive_update', 'governance_transition')),
  execution_mode TEXT NOT NULL
    CHECK (execution_mode IN ('foreground', 'background', 'scheduled', 'human_activity')),
  estimated_effort TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status = 'proposed'),
  blocker_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transformation_plan_steps_order_uq UNIQUE (plan_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_transformation_plan_steps_plan
  ON transformation_plan_steps (organization_id, plan_id, step_index);

ALTER TABLE transformation_cases
  DROP CONSTRAINT IF EXISTS transformation_cases_active_plan_fk;
ALTER TABLE transformation_cases
  ADD CONSTRAINT transformation_cases_active_plan_fk
  FOREIGN KEY (active_plan_id) REFERENCES transformation_plans(plan_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS transformation_case_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  plan_id TEXT,
  plan_version INTEGER,
  event_type TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  correlation_id TEXT,
  payload_digest TEXT NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transformation_case_audit
  ON transformation_case_audit_events (organization_id, transformation_case_id, created_at);

CREATE TABLE IF NOT EXISTS transformation_stage_proposals (
  proposal_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES transformation_plans(plan_id),
  plan_version INTEGER NOT NULL CHECK (plan_version >= 1),
  lifecycle_stage TEXT NOT NULL CHECK (lifecycle_stage IN ('initial_ideas', 'interviews', 'drd', 'opportunity_synthesis', 'finance_kpi', 'portfolio_decision', 'mobilization')),
  proposal_type TEXT NOT NULL CHECK (proposal_type IN ('create_initial_ideas', 'create_interview_assignments', 'create_drd_assessment', 'create_initiative_candidate', 'create_finance_kpi_pack', 'create_portfolio_decision', 'apply_mobilization_blueprint')),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'applied', 'cancelled')),
  payload_json JSONB NOT NULL,
  payload_digest TEXT NOT NULL,
  proposed_by_user_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  governed_proposal_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transformation_stage_proposals_unique_version
    UNIQUE (transformation_case_id, lifecycle_stage, proposal_type, plan_version)
);

CREATE INDEX IF NOT EXISTS idx_transformation_stage_proposals_case
  ON transformation_stage_proposals (organization_id, transformation_case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transformation_result_gate_governance (
  gate_mapping_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  gate_key TEXT NOT NULL CHECK (gate_key IN (
    'initiative_results','finance_kpi_results','portfolio_decision_results','mobilization_results',
    'execution_start','execution_results','delivery_handoff','benefits_review','sustainability_review'
  )),
  source_case_version INTEGER NOT NULL CHECK (source_case_version >= 1),
  governed_proposal_version_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied')),
  result_json JSONB,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transformation_case_id, gate_key)
);

CREATE INDEX IF NOT EXISTS idx_transformation_result_gate_governance
  ON transformation_result_gate_governance
  (organization_id, transformation_case_id, gate_key, status);

CREATE TABLE IF NOT EXISTS transformation_case_artifact_links (
  link_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  source_proposal_id TEXT REFERENCES transformation_stage_proposals(proposal_id),
  lineage_role TEXT NOT NULL CHECK (lineage_role IN ('input', 'output', 'evidence', 'decision')),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transformation_case_artifact_links_unique
    UNIQUE (transformation_case_id, artifact_type, artifact_id, lineage_role)
);

CREATE INDEX IF NOT EXISTS idx_transformation_case_artifact_links_case
  ON transformation_case_artifact_links
  (organization_id, transformation_case_id, lifecycle_stage, created_at);

CREATE TABLE IF NOT EXISTS transformation_final_output_runs (
  run_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  case_version INTEGER NOT NULL,
  facts_json JSONB NOT NULL,
  facts_digest TEXT NOT NULL,
  docx_path TEXT NOT NULL,
  docx_sha256 TEXT NOT NULL,
  pptx_path TEXT NOT NULL,
  pptx_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
  generated_by_user_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transformation_final_output_runs_idempotency_uq
    UNIQUE (transformation_case_id, facts_digest)
);

CREATE INDEX IF NOT EXISTS idx_transformation_final_output_runs_case
  ON transformation_final_output_runs
  (organization_id, transformation_case_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS transformation_final_output_governance (
  publication_mapping_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  source_case_version INTEGER NOT NULL,
  facts_digest TEXT NOT NULL,
  governed_proposal_version_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','published')),
  final_output_run_id TEXT REFERENCES transformation_final_output_runs(run_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transformation_final_output_governance_digest_uq
    UNIQUE (transformation_case_id, facts_digest)
);

CREATE INDEX IF NOT EXISTS idx_transformation_final_output_governance_case
  ON transformation_final_output_governance
  (organization_id, transformation_case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transformation_planning_intakes (
  intake_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  conversation_id TEXT,
  initiated_by_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('needs_clarification','ready','converted')),
  mandate TEXT NOT NULL,
  measurable_outcomes_json JSONB NOT NULL DEFAULT '[]',
  sponsor TEXT,
  scope TEXT,
  horizon TEXT,
  missing_keys_json JSONB NOT NULL DEFAULT '[]',
  converted_case_id TEXT REFERENCES transformation_cases(transformation_case_id),
  input_digest TEXT,
  source_template_id TEXT,
  source_template_version INTEGER,
  source_template_version_id TEXT,
  source_template_digest TEXT,
  template_blueprint_snapshot_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_transformation_planning_intakes_actor
  ON transformation_planning_intakes (organization_id, initiated_by_user_id, status, created_at DESC);

ALTER TABLE transformation_planning_intakes ADD COLUMN IF NOT EXISTS input_digest TEXT;
ALTER TABLE transformation_planning_intakes ADD COLUMN IF NOT EXISTS source_template_id TEXT;
ALTER TABLE transformation_planning_intakes ADD COLUMN IF NOT EXISTS source_template_version INTEGER;
ALTER TABLE transformation_planning_intakes ADD COLUMN IF NOT EXISTS source_template_version_id TEXT;
ALTER TABLE transformation_planning_intakes ADD COLUMN IF NOT EXISTS source_template_digest TEXT;
ALTER TABLE transformation_planning_intakes ADD COLUMN IF NOT EXISTS template_blueprint_snapshot_json JSONB;

ALTER TABLE transformation_plans ADD COLUMN IF NOT EXISTS source_template_id TEXT;
ALTER TABLE transformation_plans ADD COLUMN IF NOT EXISTS source_template_version INTEGER;
ALTER TABLE transformation_plans ADD COLUMN IF NOT EXISTS source_template_digest TEXT;

CREATE TABLE IF NOT EXISTS transformation_template_conversion_receipts (
  receipt_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  intake_id TEXT NOT NULL REFERENCES transformation_planning_intakes(intake_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL REFERENCES transformation_cases(transformation_case_id),
  plan_id TEXT NOT NULL REFERENCES transformation_plans(plan_id),
  canonical_run_id TEXT NOT NULL REFERENCES v8_execution_runs(run_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, intake_id, idempotency_key)
);
