-- RED-PMO (2026-07-19): re-express legacy PMO schema in Postgres dialect.
--
-- ROOT CAUSE: the live migration runner (DatabaseInitializer.runTablePlatform*)
-- only executes files matching /^(7\d{2}|\d{8})_.*\.sql$/. The legacy migrations
-- that created these objects are numbered 2xx/3xx (247_initiative_enhancements,
-- 334_initiative_watchers, 335_initiative_stakeholders) and therefore NEVER run
-- on Postgres, AND they use SQLite-only syntax (INSERT OR IGNORE, ADD COLUMN
-- without IF NOT EXISTS, DEFAULT (datetime('now'))). Result on demo/parity:
--   * initiative_watchers  — table missing  (GET /initiatives/:id/watchers  -> 42P01)
--   * initiative_history   — table missing  (GET /initiatives/:id/history   -> 42P01)
--   * initiative_comments  — table missing  (GET /initiatives/:id/comments  -> 42P01)
--   * initiative_stakeholders.influence_level / interest_level — cols missing
--                                            (GET /initiatives/:id/stakeholders -> 42703)
--   * initiatives.blocked_reason — col missing (GET /api/execution/:projectId/blockers -> 42703)
--
-- This migration is ADDITIVE + IDEMPOTENT (IF NOT EXISTS everywhere) and only
-- touches PMO/execution objects. Column shapes mirror the controller SQL in
-- server/src/controllers/InitiativeController.ts + ExecutionController.ts.

-- 1) Initiative watchers (subscriber list) — see InitiativeController.getWatchers/addWatcher.
CREATE TABLE IF NOT EXISTS initiative_watchers (
  id            TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_watchers_unique
  ON initiative_watchers(initiative_id, user_id);
CREATE INDEX IF NOT EXISTS idx_initiative_watchers_initiative
  ON initiative_watchers(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_watchers_user
  ON initiative_watchers(user_id);

-- 2) Initiative history (audit trail) — see InitiativeController.getHistory + write paths.
CREATE TABLE IF NOT EXISTS initiative_history (
  id            TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  action        TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_by    TEXT NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_initiative_history_initiative
  ON initiative_history(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_history_action
  ON initiative_history(action);

-- 3) Initiative comments — see InitiativeController.getInitiativeComments/addInitiativeComment.
CREATE TABLE IF NOT EXISTS initiative_comments (
  id              TEXT PRIMARY KEY,
  initiative_id   TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id         TEXT,
  content         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_initiative_comments_initiative
  ON initiative_comments(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_comments_org
  ON initiative_comments(organization_id);

-- 4) Stakeholder influence/interest (Power-Interest grid) — read+write both expect these.
--    Code defaults to 3 (1..5) and treats them as NOT NULL; DEFAULT 3 backfills any rows.
ALTER TABLE initiative_stakeholders
  ADD COLUMN IF NOT EXISTS influence_level INTEGER NOT NULL DEFAULT 3;
ALTER TABLE initiative_stakeholders
  ADD COLUMN IF NOT EXISTS interest_level  INTEGER NOT NULL DEFAULT 3;

-- 5) Initiative blocked_reason — used by ExecutionController.getBlockers and status flow.
ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
