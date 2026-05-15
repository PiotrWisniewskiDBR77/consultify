-- 20260513: User Function Profile
-- Canonical user function metadata used by onboarding, settings, admin,
-- interview interpretation, and future task/person recommendation.

ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS seniority_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenure_years TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manages_team BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_size TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise_tags TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS engagement_level TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS out_of_office INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vacation_end TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_survey_completed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_survey_dismissed_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_survey_last_dismissed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_org_department ON users (organization_id, department);
CREATE INDEX IF NOT EXISTS idx_users_org_job_title ON users (organization_id, job_title);
CREATE INDEX IF NOT EXISTS idx_users_org_site_location ON users (organization_id, site_location);
