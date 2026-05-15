-- V4-INBX-01: Canonical inbox schema — triage with ai_confidence + undo support
ALTER TABLE my_work_inbox_triage ADD COLUMN IF NOT EXISTS from_ai INTEGER DEFAULT 0;
ALTER TABLE my_work_inbox_triage ADD COLUMN IF NOT EXISTS ai_confidence REAL;
CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_triaged_at_desc
  ON my_work_inbox_triage(user_id, triaged_at DESC);

-- V4-INBX-02: Focus board rules (max items per day, capacity-aware)
CREATE TABLE IF NOT EXISTS my_work_focus_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  max_today INTEGER DEFAULT 5,
  max_week INTEGER DEFAULT 15,
  capacity_aware INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_my_work_focus_rules_user ON my_work_focus_rules(user_id);
