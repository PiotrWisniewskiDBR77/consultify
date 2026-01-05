-- Access Codes Engine Migration
-- Unifies Referrals, Team Invites, and Consultant Codes
-- Handles migration from legacy access_codes table

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- 1. Rename existing table key constraints might be an issue so we disable FKs
-- Check if table exists is hard in pure SQL script without dynamic execution. 
-- Assuming it exists based on earlier check.
ALTER TABLE access_codes RENAME TO access_codes_legacy;

-- 2. Create new table
CREATE TABLE access_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- Human-friendly code (e.g., JOIN-1234, CONS-ABCD)
    type TEXT NOT NULL, -- REFERRAL | INVITE | CONSULTANT | TRIAL
    
    -- Creation Context
    created_by_user_id TEXT,
    created_by_consultant_id TEXT, 
    organization_id TEXT, -- Nullable now
    
    -- Constraints
    expires_at DATETIME,
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    
    -- State
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    
    -- Payload & Attribution
    metadata_json TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by_consultant_id) REFERENCES consultants(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- 3. Migrate data
INSERT INTO access_codes (
    id, code, type, created_by_user_id, organization_id, 
    expires_at, max_uses, uses_count, status, created_at
)
SELECT 
    id, code, 'INVITE', created_by, organization_id,
    expires_at, max_uses, current_uses, 
    CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'REVOKED' END,
    created_at
FROM access_codes_legacy;

-- 4. Drop legacy table
DROP TABLE access_codes_legacy;

-- 5. Recreate Indices
CREATE INDEX idx_access_codes_code ON access_codes(code);
CREATE INDEX idx_access_codes_type ON access_codes(type);
CREATE INDEX idx_access_codes_consultant ON access_codes(created_by_consultant_id);
CREATE INDEX idx_access_codes_org ON access_codes(organization_id);

COMMIT;

PRAGMA foreign_keys=ON;
