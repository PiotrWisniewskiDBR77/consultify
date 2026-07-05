-- M14/F5 (5.3): plan baseline / rebaseline.
-- Each row is an approved snapshot of the rollout (implementation) plan at a
-- point in time. `snapshot` holds the JSON state of the plan when it was
-- baselined; later actuals are compared against the latest baseline to compute
-- schedule slip (see rolloutBaselineService.computeSlip).
-- Org-scoped; a project may accumulate many baselines (the most recent wins for
-- rebaseline / slip comparison).

CREATE TABLE IF NOT EXISTS plan_baselines (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  label           TEXT,
  snapshot        TEXT NOT NULL,
  reason          TEXT,
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_baselines_org_project
  ON plan_baselines(organization_id, project_id);
