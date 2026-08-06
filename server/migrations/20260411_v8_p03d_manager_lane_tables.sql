-- P03-D: Manager 6-lane cockpit tables
-- v8_lane_decisions stores operator accept/reject/defer on lane suggestions
-- v8_lane_execution_plans stores concrete plans from accepted decisions

CREATE TABLE IF NOT EXISTS v8_lane_decisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lane_id TEXT NOT NULL,
  suggestion_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS v8_lane_decisions_org_lane_suggestion_idx
  ON v8_lane_decisions (organization_id, lane_id, suggestion_id);

CREATE INDEX IF NOT EXISTS idx_v8_lane_decisions_org_lane
  ON v8_lane_decisions (organization_id, lane_id);

CREATE TABLE IF NOT EXISTS v8_lane_execution_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  lane_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  tasks_json TEXT DEFAULT '[]',
  before_state TEXT,
  after_state TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(decision_id) REFERENCES v8_lane_decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_v8_lane_execution_plans_org_lane
  ON v8_lane_execution_plans (organization_id, lane_id);
