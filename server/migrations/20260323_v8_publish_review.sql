-- V8 Shared Publish and Review Semantics — WP-W6-OUT-04
-- Unified publish lifecycle, review gates, coordinated publish, output recall,
-- and finance locked state across all output types.
--
-- Decisions applied:
--   W6-11 — finance locked state extends shared lifecycle
--   W6-12 — coordinated publish for paired outputs
--   W6-13 — output recall: explicit, auditable, lineage preserved

-- Publish lifecycle records
CREATE TABLE IF NOT EXISTS v8_publish_records (
  record_id        TEXT PRIMARY KEY,
  artifact_id      TEXT NOT NULL,
  artifact_type    TEXT NOT NULL CHECK (artifact_type IN ('report', 'presentation', 'finance_output', 'results_artifact')),
  organization_id  TEXT NOT NULL,
  current_state    TEXT NOT NULL DEFAULT 'private_draft' CHECK (current_state IN ('private_draft', 'reviewable_share', 'team_visible', 'in_review', 'approved', 'published', 'recalled', 'archived')),
  published_by     TEXT NOT NULL,
  published_at     TEXT,
  reviewers        TEXT NOT NULL DEFAULT '[]',
  approved_by      TEXT,
  approved_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_pub_rec_org          ON v8_publish_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_pub_rec_artifact     ON v8_publish_records(artifact_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_pub_rec_state        ON v8_publish_records(current_state);
CREATE INDEX IF NOT EXISTS idx_v8_pub_rec_type         ON v8_publish_records(artifact_type);
CREATE INDEX IF NOT EXISTS idx_v8_pub_rec_published_by ON v8_publish_records(published_by);

-- Review gates
CREATE TABLE IF NOT EXISTS v8_review_gates (
  gate_id          TEXT PRIMARY KEY,
  artifact_id      TEXT NOT NULL,
  organization_id  TEXT NOT NULL,
  review_type      TEXT NOT NULL CHECK (review_type IN ('peer_review', 'manager_approval', 'compliance_review', 'quality_gate')),
  reviewer_id      TEXT NOT NULL,
  result           TEXT NOT NULL CHECK (result IN ('approved', 'rejected', 'changes_requested')),
  comments         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_rev_gate_org       ON v8_review_gates(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_rev_gate_artifact  ON v8_review_gates(artifact_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_rev_gate_type      ON v8_review_gates(review_type);
CREATE INDEX IF NOT EXISTS idx_v8_rev_gate_reviewer  ON v8_review_gates(reviewer_id);

-- Coordinated publishes for paired outputs (Decision W6-12)
CREATE TABLE IF NOT EXISTS v8_coordinated_publishes (
  coordination_id        TEXT PRIMARY KEY,
  primary_artifact_id    TEXT NOT NULL,
  paired_artifact_id     TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  coordination_mode      TEXT NOT NULL DEFAULT 'coordinated' CHECK (coordination_mode IN ('coordinated', 'independent')),
  coordinated_publish_at TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_coord_pub_org      ON v8_coordinated_publishes(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_coord_pub_primary  ON v8_coordinated_publishes(primary_artifact_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_coord_pub_paired   ON v8_coordinated_publishes(paired_artifact_id, organization_id);

-- Output recall records (Decision W6-13)
CREATE TABLE IF NOT EXISTS v8_output_recalls (
  recall_id          TEXT PRIMARY KEY,
  artifact_id        TEXT NOT NULL,
  organization_id    TEXT NOT NULL,
  recalled_by        TEXT NOT NULL,
  reason             TEXT NOT NULL,
  recalled_at        TEXT NOT NULL DEFAULT (datetime('now')),
  post_recall_state  TEXT NOT NULL DEFAULT 'recalled' CHECK (post_recall_state = 'recalled'),
  lineage_preserved  INTEGER NOT NULL DEFAULT 1 CHECK (lineage_preserved = 1)
);

CREATE INDEX IF NOT EXISTS idx_v8_recall_org       ON v8_output_recalls(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_recall_artifact  ON v8_output_recalls(artifact_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_recall_by        ON v8_output_recalls(recalled_by);

-- Finance locked states (Decision W6-11)
CREATE TABLE IF NOT EXISTS v8_finance_locked_states (
  lock_id          TEXT PRIMARY KEY,
  artifact_id      TEXT NOT NULL,
  organization_id  TEXT NOT NULL,
  locked_by        TEXT NOT NULL,
  lock_reason      TEXT NOT NULL,
  lock_level       TEXT NOT NULL DEFAULT 'standard' CHECK (lock_level IN ('standard', 'finance_strict')),
  locked_at        TEXT NOT NULL DEFAULT (datetime('now')),
  unlocked_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_fin_lock_org       ON v8_finance_locked_states(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fin_lock_artifact  ON v8_finance_locked_states(artifact_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fin_lock_level     ON v8_finance_locked_states(lock_level);
CREATE INDEX IF NOT EXISTS idx_v8_fin_lock_by        ON v8_finance_locked_states(locked_by);
