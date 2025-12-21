-- Migration: Trial Entry Status
-- Adds user_status column and trial_entry tracking

-- Add user_status column to users table
ALTER TABLE users ADD COLUMN user_status TEXT DEFAULT 'ACTIVE';
-- Valid values: ACTIVE, TRIAL_ENTRY, TRIAL_ORG, SUSPENDED

-- Add trial entry timestamp
ALTER TABLE users ADD COLUMN trial_entry_started_at TEXT;

-- Add trial entry source (which code was used)
ALTER TABLE users ADD COLUMN trial_entry_source_code_id TEXT;

-- Index for quick lookup of trial entry users
CREATE INDEX IF NOT EXISTS idx_users_user_status ON users(user_status);

-- Audit event type for trial entry
-- (organization_events table already exists, we'll use it with TRIAL_ENTERED event type)
