-- Interview Insight Scope Builder + Material Quality contract
-- Purpose:
--  - Persist the consultant scope used to generate an Interview Insight
--  - Persist post-generation material quality without breaking legacy insights
--  - Keep the migration additive and safe for existing rows

ALTER TABLE interview_insights
  ADD COLUMN IF NOT EXISTS analysis_scope_json TEXT DEFAULT '{}';

ALTER TABLE interview_insights
  ADD COLUMN IF NOT EXISTS material_quality_json TEXT DEFAULT '{}';

ALTER TABLE interview_insights
  ADD COLUMN IF NOT EXISTS context_mode TEXT;

ALTER TABLE interview_insights
  ADD COLUMN IF NOT EXISTS analysis_mode TEXT;

ALTER TABLE interview_insights
  ADD COLUMN IF NOT EXISTS topic_focus_json TEXT DEFAULT '[]';

ALTER TABLE interview_insights
  ADD COLUMN IF NOT EXISTS generation_context_json TEXT DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_interview_insights_context_mode
  ON interview_insights(context_mode);

CREATE INDEX IF NOT EXISTS idx_interview_insights_analysis_mode
  ON interview_insights(analysis_mode);

