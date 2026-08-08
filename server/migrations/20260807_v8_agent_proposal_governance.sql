CREATE TABLE IF NOT EXISTS v8_agent_proposal_versions (
  proposal_version_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  canonical_run_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL CHECK (proposal_version >= 1),
  plan_version INTEGER NOT NULL CHECK (plan_version >= 1),
  context_digest TEXT NOT NULL,
  before_json JSONB NOT NULL,
  after_json JSONB NOT NULL,
  approval_scopes_json JSONB NOT NULL,
  reviewer_authority_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review','partially_approved','approved','rejected','revision_requested','expired','invalidated','superseded')),
  invalidation_reason TEXT,
  supersedes_proposal_version_id TEXT REFERENCES v8_agent_proposal_versions(proposal_version_id),
  revision_kind TEXT NOT NULL DEFAULT 'initial' CHECK (revision_kind IN ('initial','revision','rebaseline')),
  change_reason TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, proposal_version)
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_proposal_versions_run
  ON v8_agent_proposal_versions (organization_id, canonical_run_id, status, created_at);

CREATE TABLE IF NOT EXISTS v8_agent_proposal_scope_reviews (
  review_id TEXT PRIMARY KEY,
  proposal_version_id TEXT NOT NULL REFERENCES v8_agent_proposal_versions(proposal_version_id),
  scope_key TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','revision_requested')),
  reason TEXT NOT NULL,
  reviewed_by_user_id TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_version_id, scope_key)
);

CREATE TABLE IF NOT EXISTS v8_agent_proposal_governance_events (
  event_id TEXT PRIMARY KEY,
  proposal_version_id TEXT NOT NULL REFERENCES v8_agent_proposal_versions(proposal_version_id),
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('registered','scope_approved','scope_rejected','revision_requested','revised','rebaselined','invalidated','expired')),
  scope_key TEXT,
  actor_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_proposal_governance_events
  ON v8_agent_proposal_governance_events (organization_id, proposal_version_id, created_at);

DO $$
BEGIN
  IF to_regclass('public.transformation_stage_proposals') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conname = 'transformation_stage_proposals_governed_version_fk'
     ) THEN
    ALTER TABLE transformation_stage_proposals
      ADD CONSTRAINT transformation_stage_proposals_governed_version_fk
      FOREIGN KEY (governed_proposal_version_id)
      REFERENCES v8_agent_proposal_versions(proposal_version_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transformation_final_output_governance') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conname = 'transformation_final_output_governed_version_fk'
     ) THEN
    ALTER TABLE transformation_final_output_governance
      ADD CONSTRAINT transformation_final_output_governed_version_fk
      FOREIGN KEY (governed_proposal_version_id)
      REFERENCES v8_agent_proposal_versions(proposal_version_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transformation_result_gate_governance') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conname = 'transformation_result_gate_governed_version_fk'
     ) THEN
    ALTER TABLE transformation_result_gate_governance
      ADD CONSTRAINT transformation_result_gate_governed_version_fk
      FOREIGN KEY (governed_proposal_version_id)
      REFERENCES v8_agent_proposal_versions(proposal_version_id);
  END IF;
END $$;
