-- 036: User Profile Metrics for VTS Pilot
-- Adds team-member metadata used for interview assignment, response evaluation,
-- and later task/initiative assignment.

-- Core profile fields (some may already exist on user_profiles but we need them
-- on the users row so /me can return them without a JOIN).
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id TEXT;

-- VTS-specific metrics
ALTER TABLE users ADD COLUMN IF NOT EXISTS seniority_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenure_years TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manages_team BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_size TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise_tags TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS engagement_level TEXT;

-- Profile survey nudge tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_survey_completed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_survey_dismissed_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_survey_last_dismissed_at TIMESTAMP;
