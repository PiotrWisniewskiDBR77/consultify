-- EXE-02/03/04 execution management spine — idempotent-retry support for
-- initiative-scoped creation endpoints: milestones, resources, RAID items,
-- tasks. A client-supplied `idempotencyKey` on the POST body lets a retried
-- request (network drop, double-click, at-least-once queue) return the
-- original row instead of inserting a duplicate.
--
-- Uniqueness is scoped per initiative_id (not global) so two unrelated
-- initiatives can each reuse a simple client-generated key without collision.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB):
-- only ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

ALTER TABLE initiative_milestones ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- The canonical controllers already read/write these lifecycle fields, but a
-- fresh acceptance database can miss them because their historical DDL lives
-- in baseline/never-ran migrations. Keep the execution spine self-contained
-- with additive, replay-safe reconciliation.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expected_outcome TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS decision_impact TEXT DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS evidence_required TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS strategic_contribution TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS roadmap_initiative_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS raid_item_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees TEXT DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS backup_assignee_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workstream_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_acceptance BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptor_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weight_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_by_decision_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_fields_json TEXT DEFAULT '{}';

ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS allocation_percentage INTEGER DEFAULT 100;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS required_capacity_fte REAL DEFAULT 0;

ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS score_category TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS mitigation_plan TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS response_strategy TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS mitigation_owner_id TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS mitigation_due_date DATE;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS mitigation_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_milestones_idempotency
  ON initiative_milestones(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_resources_idempotency
  ON initiative_resources(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_items_idempotency
  ON raid_items(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_idempotency
  ON tasks(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
