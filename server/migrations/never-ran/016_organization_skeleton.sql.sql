-- Migration: Organization Skeleton
-- Description: Adds organization_members table, fields to organizations, and billing stub.

-- 1. Add fields to organizations (if they don't exist)
-- SQLite doesn't support IF NOT EXISTS for columns, so we try, and if it fails (because exists), it's fine.
-- But since we are writing a migration script that might run on a fresh DB or existing one, we should be careful.
-- However, for this environment, we can assume we are appending.

-- We'll use a transaction
BEGIN TRANSACTION;

-- Add billing_status to organizations
ALTER TABLE organizations ADD COLUMN billing_status TEXT DEFAULT 'TRIAL';

-- Add token_balance to organizations
ALTER TABLE organizations ADD COLUMN token_balance INTEGER DEFAULT 0;

-- 2. Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT')),
    status TEXT DEFAULT 'ACTIVE',
    invited_by_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, user_id)
);

-- Index for fast lookup of user's organizations
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- 3. Create organization_billing table (Stub)
CREATE TABLE IF NOT EXISTS organization_billing (
    organization_id TEXT PRIMARY KEY,
    customer_id TEXT,
    subscription_id TEXT,
    status TEXT, -- 'ACTIVE', 'PAST_DUE', 'CANCELED'
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

COMMIT;
