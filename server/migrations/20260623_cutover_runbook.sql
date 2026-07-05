-- M14 / F5 (5.4): Cutover runbook + rollback triggers.
-- A cutover runbook captures the go-live plan for an initiative stage:
-- an ordered list of steps (with owners + time windows) plus dedicated
-- rollback steps, and a go/no-go decision gate.
-- org-scoped, node-pg snake_case.

CREATE TABLE IF NOT EXISTS cutover_runbooks (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id   TEXT,
  stage_id        TEXT,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'planned',
  go_no_go        TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cutover_runbooks_org
  ON cutover_runbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_cutover_runbooks_org_initiative
  ON cutover_runbooks(organization_id, initiative_id);

CREATE TABLE IF NOT EXISTS cutover_steps (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  runbook_id      TEXT NOT NULL,
  sequence        INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL,
  owner_id        TEXT,
  time_window     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  is_rollback     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cutover_steps_org
  ON cutover_steps(organization_id);
CREATE INDEX IF NOT EXISTS idx_cutover_steps_runbook
  ON cutover_steps(organization_id, runbook_id, sequence);
