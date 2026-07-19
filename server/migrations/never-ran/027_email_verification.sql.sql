-- Migration: 027_email_verification.sql
-- Email Verification System
-- Created: 2025-12-21

-- Email verification fields for users
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verification_token TEXT;
ALTER TABLE users ADD COLUMN email_verification_sent_at TEXT; -- ISO datetime
ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT; -- ISO datetime

-- Email change verification (for security when changing email)
ALTER TABLE users ADD COLUMN pending_email TEXT;
ALTER TABLE users ADD COLUMN email_change_token TEXT;
ALTER TABLE users ADD COLUMN email_change_requested_at TEXT;

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_change_token ON users(email_change_token);
