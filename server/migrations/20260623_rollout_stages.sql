-- M14/F5 (5.1) — Rollout stages layer (`rollout_stages`).
--
-- Stores the wave-based rollout plan for an implementation/execution program:
-- pilot → limited → full → hypercare → closure. Each row is one stage (wave)
-- of a project's rollout, ordered by `sequence`, with planned vs. baseline
-- dates and entry/exit gating criteria.
--
-- Design notes:
--   - id TEXT PK (uuid v4 from the service layer).
--   - org-scoped: every query filters by organization_id.
--   - wave_type CHECK enumerates the canonical wave taxonomy.
--   - status lifecycle: not_started → active → gated → done.
--   - dates stored as TEXT (ISO strings) — Postgres + SQLite safe.
--   - CREATE TABLE IF NOT EXISTS so the migration is idempotent.

CREATE TABLE IF NOT EXISTS rollout_stages (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  project_id       TEXT,
  name             TEXT NOT NULL,
  wave_type        TEXT NOT NULL CHECK (wave_type IN ('pilot','limited','full','hypercare','closure')),
  sequence         INTEGER NOT NULL DEFAULT 0,
  planned_start    TEXT,
  planned_end      TEXT,
  baseline_start   TEXT,
  baseline_end     TEXT,
  status           TEXT NOT NULL DEFAULT 'not_started',
  entry_criteria   TEXT,
  exit_criteria    TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rollout_stages_org
  ON rollout_stages(organization_id);

CREATE INDEX IF NOT EXISTS idx_rollout_stages_org_project
  ON rollout_stages(organization_id, project_id);
