-- Assessment collaboration (comments / presence / activities)
-- Backs the FE contract in:
--   src/components/assessment/AxisCommentsPanel.tsx      (comments)
--   src/hooks/useAssessmentCollaboration.tsx             (presence + activities)
-- Endpoints live in server/src/routes/assessment/assessment-workflow.routes.ts.
-- Route code also self-heals these tables at runtime (CREATE TABLE IF NOT EXISTS)
-- so the endpoints work even where this migration has not been applied.

CREATE TABLE IF NOT EXISTS assessment_comments (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  axis_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  comment TEXT NOT NULL,
  parent_comment_id TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_comments_lookup ON assessment_comments (assessment_id, axis_id);
CREATE INDEX IF NOT EXISTS idx_assessment_comments_org ON assessment_comments (organization_id);

CREATE TABLE IF NOT EXISTS assessment_activities (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  activity_type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessment_activities_lookup ON assessment_activities (assessment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_activities_org ON assessment_activities (organization_id);

CREATE TABLE IF NOT EXISTS assessment_presence (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  current_axis TEXT,
  current_view TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  is_connected BOOLEAN DEFAULT TRUE,
  UNIQUE (assessment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_presence_lookup ON assessment_presence (assessment_id);
