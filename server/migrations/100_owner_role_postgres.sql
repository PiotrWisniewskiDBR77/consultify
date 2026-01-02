-- =========================================================
-- Migration: 100_owner_role_postgres.sql
-- Purpose: Add Owner role support and ownership transfer tracking (PostgreSQL)
-- Date: 2026-01-01
-- =========================================================

-- Add owner_id to organizations (the billing/account owner)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- Add is_owner flag to users for quick lookup
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- Create ownership_transfers audit table
CREATE TABLE IF NOT EXISTS ownership_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transferred_by UUID NOT NULL REFERENCES users(id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_org ON ownership_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_is_owner ON users(is_owner) WHERE is_owner = TRUE;

-- Set the first ADMIN of each organization as the default owner (one-time migration)
UPDATE users 
SET is_owner = TRUE 
WHERE id IN (
    SELECT DISTINCT ON (organization_id) id 
    FROM users 
    WHERE role = 'ADMIN' 
    ORDER BY organization_id, created_at ASC
);

-- Update organizations.owner_id to match
UPDATE organizations o
SET owner_id = (
    SELECT id FROM users u
    WHERE u.organization_id = o.id 
    AND u.is_owner = TRUE 
    LIMIT 1
)
WHERE owner_id IS NULL;


