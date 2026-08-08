CREATE TABLE IF NOT EXISTS transformation_project_team_blueprints (
  blueprint_version_id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  transformation_case_id TEXT NOT NULL REFERENCES transformation_cases(transformation_case_id),
  canonical_run_id TEXT NOT NULL,
  case_version INTEGER NOT NULL,
  blueprint_version INTEGER NOT NULL CHECK (blueprint_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('needs_clarification','pending_approval','approved','activated','superseded')),
  sponsor_user_id TEXT,
  members_json JSONB NOT NULL,
  raci_json JSONB NOT NULL,
  agent_limits_json JSONB NOT NULL,
  work_json JSONB NOT NULL,
  missing_keys_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  clarification_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_digest TEXT NOT NULL,
  governed_proposal_version_id TEXT REFERENCES v8_agent_proposal_versions(proposal_version_id),
  proposed_by_user_id TEXT NOT NULL,
  approved_by_user_id TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blueprint_id, blueprint_version)
);
CREATE INDEX IF NOT EXISTS idx_t01_team_blueprints_case
  ON transformation_project_team_blueprints (organization_id, transformation_case_id, blueprint_version DESC);

CREATE TABLE IF NOT EXISTS transformation_project_team_receipts (
  receipt_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  blueprint_version_id TEXT NOT NULL REFERENCES transformation_project_team_blueprints(blueprint_version_id),
  action TEXT NOT NULL CHECK (action IN ('propose','approve','activate')),
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  result_json JSONB NOT NULL,
  actor_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS transformation_project_team_audit_events (
  event_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transformation_case_id TEXT NOT NULL,
  blueprint_version_id TEXT NOT NULL REFERENCES transformation_project_team_blueprints(blueprint_version_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('proposed','clarification_required','approved','activated')),
  actor_user_id TEXT NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
