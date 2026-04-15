-- Performance indexes for canonical inbox and source tables used by inbox materialization.

-- Composite index for the primary inbox query pattern: user + org + status
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_user_org_status
  ON canonical_inbox_items(user_id, organization_id, status);

-- Composite index for task queries during materialization
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_org_status
  ON tasks(organization_id, assignee_id);

-- Composite index for decision queries during materialization
CREATE INDEX IF NOT EXISTS idx_decisions_maker_org_status
  ON decisions(organization_id, decision_maker_id);
