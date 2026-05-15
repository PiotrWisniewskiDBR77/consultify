-- Interview Insight Activity Log
-- Provides a minimal, generic activity feed for Interview Insights.
-- Used by: GET /interview/insights/:id/activity

CREATE TABLE IF NOT EXISTS interview_insight_activity (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_org
  ON interview_insight_activity(organization_id);

CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_insight
  ON interview_insight_activity(insight_id);

CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_created
  ON interview_insight_activity(created_at DESC);

