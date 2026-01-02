-- =========================================================
-- Migration: 100_owner_role.sql
-- Purpose: Add Owner role support and ownership transfer tracking
-- Date: 2026-01-01
-- =========================================================

-- Add owner_id to organizations (the billing/account owner)
-- SQLite compatible syntax
ALTER TABLE organizations ADD COLUMN owner_id TEXT REFERENCES users(id);

-- Add is_owner flag to users for quick lookup
ALTER TABLE users ADD COLUMN is_owner INTEGER DEFAULT 0;

-- Create ownership_transfers audit table
CREATE TABLE IF NOT EXISTS ownership_transfers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    reason TEXT,
    transferred_at TEXT DEFAULT (datetime('now')),
    transferred_by TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id),
    FOREIGN KEY (transferred_by) REFERENCES users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_org ON ownership_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_is_owner ON users(is_owner);

-- Set the first ADMIN of each organization as the default owner (one-time migration)
-- This ensures existing organizations have an owner
UPDATE users 
SET is_owner = 1 
WHERE id IN (
    SELECT MIN(u.id) 
    FROM users u 
    WHERE u.role = 'ADMIN' 
    GROUP BY u.organization_id
);

-- Update organizations.owner_id to match
UPDATE organizations 
SET owner_id = (
    SELECT id FROM users 
    WHERE users.organization_id = organizations.id 
    AND users.is_owner = 1 
    LIMIT 1
);


