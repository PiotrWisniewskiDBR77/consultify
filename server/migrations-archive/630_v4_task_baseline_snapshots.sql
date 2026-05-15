-- V4-TASK-04: Baseline snapshots for schedule comparison
-- Stores point-in-time snap of task dates/durations for baseline vs actual comparison

CREATE TABLE IF NOT EXISTS task_baseline_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  project_id TEXT,
  snapshot_type TEXT NOT NULL DEFAULT 'manual',
  snapshot_at TIMESTAMP NOT NULL,
  created_by TEXT,
  tasks_json TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_baseline_snapshots_org ON task_baseline_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_baseline_snapshots_initiative ON task_baseline_snapshots(initiative_id);
CREATE INDEX IF NOT EXISTS idx_task_baseline_snapshots_project ON task_baseline_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_task_baseline_snapshots_at ON task_baseline_snapshots(snapshot_at);
