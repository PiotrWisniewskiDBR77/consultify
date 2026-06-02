-- Migration: Add profile fields and permission_requests table
-- 
-- New columns in users:
-- - job_title
-- - linked_accounts (JSON)
-- 
-- New table: permission_requests

-- Add job_title column to users (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'job_title'
    ) THEN
        ALTER TABLE users ADD COLUMN job_title TEXT;
    END IF;
END $$;

-- Add linked_accounts column to users (JSON for Google/LinkedIn connections)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'linked_accounts'
    ) THEN
        ALTER TABLE users ADD COLUMN linked_accounts JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create permission_requests table
CREATE TABLE IF NOT EXISTS permission_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    current_value TEXT,
    requested_value TEXT,
    justification TEXT,
    status TEXT DEFAULT 'PENDING',
    priority TEXT DEFAULT 'NORMAL',
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_permission_requests_user ON permission_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_org ON permission_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
