-- Migration 732: Add onboarding_status column to organizations if missing
-- Required by accessPolicyService to gate trial AI access

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_plan_snapshot TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_plan_version INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_accepted_at TIMESTAMP;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS transformation_context TEXT DEFAULT '{}';
