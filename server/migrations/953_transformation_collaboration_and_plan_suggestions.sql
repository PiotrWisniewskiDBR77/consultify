-- 953: Agent Hub durable collaboration policy, authorship and proposal-first plan suggestions.

ALTER TABLE transformation_cases
  ADD COLUMN IF NOT EXISTS collaboration_mode TEXT NOT NULL DEFAULT 'teresa_draft_human_edit';
ALTER TABLE transformation_cases
  ADD COLUMN IF NOT EXISTS current_editor TEXT NOT NULL DEFAULT 'human';
ALTER TABLE transformation_cases
  ADD COLUMN IF NOT EXISTS autonomy_policy_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE transformation_cases DROP CONSTRAINT IF EXISTS transformation_cases_collaboration_mode_check;
ALTER TABLE transformation_cases ADD CONSTRAINT transformation_cases_collaboration_mode_check
  CHECK (collaboration_mode IN (
    'teresa_led', 'human_led', 'teresa_draft_human_edit', 'human_draft_teresa_review'
  ));
ALTER TABLE transformation_cases DROP CONSTRAINT IF EXISTS transformation_cases_current_editor_check;
ALTER TABLE transformation_cases ADD CONSTRAINT transformation_cases_current_editor_check
  CHECK (current_editor IN ('human', 'teresa'));
ALTER TABLE transformation_cases DROP CONSTRAINT IF EXISTS transformation_cases_autonomy_policy_version_check;
ALTER TABLE transformation_cases ADD CONSTRAINT transformation_cases_autonomy_policy_version_check
  CHECK (autonomy_policy_version >= 1);

ALTER TABLE transformation_plans
  ADD COLUMN IF NOT EXISTS created_by_type TEXT NOT NULL DEFAULT 'human';
ALTER TABLE transformation_plans ADD COLUMN IF NOT EXISTS created_by_id TEXT;
ALTER TABLE transformation_plans ADD COLUMN IF NOT EXISTS based_on_plan_version INTEGER;
ALTER TABLE transformation_plans ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE transformation_plans
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE transformation_plans DROP CONSTRAINT IF EXISTS transformation_plans_created_by_type_check;
ALTER TABLE transformation_plans ADD CONSTRAINT transformation_plans_created_by_type_check
  CHECK (created_by_type IN ('human', 'teresa', 'template'));
ALTER TABLE transformation_plans DROP CONSTRAINT IF EXISTS transformation_plans_review_status_check;
ALTER TABLE transformation_plans ADD CONSTRAINT transformation_plans_review_status_check
  CHECK (review_status IN ('pending', 'in_review', 'accepted', 'changes_requested'));
ALTER TABLE transformation_plans DROP CONSTRAINT IF EXISTS transformation_plans_based_on_version_check;
ALTER TABLE transformation_plans ADD CONSTRAINT transformation_plans_based_on_version_check
  CHECK (based_on_plan_version IS NULL OR based_on_plan_version >= 1);

UPDATE transformation_plans
   SET created_by_id = COALESCE(created_by_id, created_by_user_id)
 WHERE created_by_id IS NULL;

ALTER TABLE transformation_plan_steps ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'template';
ALTER TABLE transformation_plan_steps
  ADD COLUMN IF NOT EXISTS last_edited_by_type TEXT NOT NULL DEFAULT 'human';
ALTER TABLE transformation_plan_steps
  ADD COLUMN IF NOT EXISTS execution_actor TEXT NOT NULL DEFAULT 'system';
ALTER TABLE transformation_plan_steps ADD COLUMN IF NOT EXISTS runtime_capability_key TEXT;
ALTER TABLE transformation_plan_steps ADD COLUMN IF NOT EXISTS capability_checked_at TIMESTAMPTZ;

ALTER TABLE transformation_plan_steps DROP CONSTRAINT IF EXISTS transformation_plan_steps_origin_check;
ALTER TABLE transformation_plan_steps ADD CONSTRAINT transformation_plan_steps_origin_check
  CHECK (origin IN ('human', 'teresa', 'template'));
ALTER TABLE transformation_plan_steps DROP CONSTRAINT IF EXISTS transformation_plan_steps_last_editor_check;
ALTER TABLE transformation_plan_steps ADD CONSTRAINT transformation_plan_steps_last_editor_check
  CHECK (last_edited_by_type IN ('human', 'teresa'));
ALTER TABLE transformation_plan_steps DROP CONSTRAINT IF EXISTS transformation_plan_steps_execution_actor_check;
ALTER TABLE transformation_plan_steps ADD CONSTRAINT transformation_plan_steps_execution_actor_check
  CHECK (execution_actor IN ('human', 'teresa', 'system'));

CREATE TABLE IF NOT EXISTS transformation_plan_suggestions (
  suggestion_id TEXT PRIMARY KEY,
  transformation_case_id TEXT NOT NULL
    REFERENCES transformation_cases(transformation_case_id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  source_plan_id TEXT NOT NULL REFERENCES transformation_plans(plan_id) ON DELETE CASCADE,
  source_plan_version INTEGER NOT NULL CHECK (source_plan_version >= 1),
  suggested_by_type TEXT NOT NULL CHECK (suggested_by_type IN ('teresa', 'human')),
  suggested_by_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'accepted', 'rejected', 'superseded')),
  semantic_diff_json JSONB NOT NULL,
  rationale TEXT NOT NULL CHECK (length(trim(rationale)) > 0),
  impact TEXT NOT NULL CHECK (length(trim(impact)) > 0),
  evidence_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  diff_digest TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  resolved_by_user_id TEXT,
  resolution_reason TEXT,
  resulting_plan_id TEXT REFERENCES transformation_plans(plan_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (organization_id, transformation_case_id, idempotency_key),
  UNIQUE (organization_id, transformation_case_id, diff_digest, source_plan_version)
);

CREATE INDEX IF NOT EXISTS idx_transformation_plan_suggestions_case
  ON transformation_plan_suggestions
  (organization_id, transformation_case_id, status, created_at DESC);
