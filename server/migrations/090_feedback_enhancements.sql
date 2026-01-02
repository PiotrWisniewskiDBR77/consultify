-- Migration: 090_feedback_enhancements
-- Description: Enhance system_feedback table with admin response fields and additional metadata
-- Date: 2026-01-01

-- Add new columns to system_feedback table
ALTER TABLE system_feedback ADD COLUMN user_name TEXT;
ALTER TABLE system_feedback ADD COLUMN rating INTEGER;
ALTER TABLE system_feedback ADD COLUMN priority TEXT DEFAULT 'medium';
ALTER TABLE system_feedback ADD COLUMN metadata TEXT; -- JSON for browser, page, etc.
ALTER TABLE system_feedback ADD COLUMN admin_response TEXT;
ALTER TABLE system_feedback ADD COLUMN admin_notes TEXT;
ALTER TABLE system_feedback ADD COLUMN responded_at DATETIME;
ALTER TABLE system_feedback ADD COLUMN responded_by TEXT;
ALTER TABLE system_feedback ADD COLUMN updated_at DATETIME;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_feedback_status ON system_feedback(status);
CREATE INDEX IF NOT EXISTS idx_system_feedback_type ON system_feedback(type);
CREATE INDEX IF NOT EXISTS idx_system_feedback_user ON system_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_system_feedback_priority ON system_feedback(priority);


