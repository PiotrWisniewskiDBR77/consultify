-- GAP-AUTH-001: Email verification flow
-- Migration: 241_email_verification.sql

-- Add email_verified column to users
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);

-- Mark existing users as verified (they were using the system already)
UPDATE users SET email_verified = 1, email_verified_at = datetime('now') WHERE email_verified IS NULL OR email_verified = 0;
