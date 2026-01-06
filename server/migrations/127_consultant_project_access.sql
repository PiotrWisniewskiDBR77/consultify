-- Migration: Consultant Project Access
-- Purpose: Enable project-level consultant access without consuming organization seats
-- Date: 2026-01-02

-- Table for tracking consultant access to specific projects
CREATE TABLE IF NOT EXISTS consultant_project_access (
    id TEXT PRIMARY KEY,
    consultant_user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Invitation details
    invited_by_user_id TEXT NOT NULL,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    
    -- Access code (allows free seat)
    access_code TEXT,
    access_code_used_at DATETIME,
    
    -- Status
    status TEXT DEFAULT 'PENDING', -- PENDING, ACTIVE, REVOKED, EXPIRED
    
    -- Custom permissions (JSON) - initially all false
    permissions TEXT DEFAULT '{}',
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(consultant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(consultant_user_id, project_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_consultant_project_access_consultant 
ON consultant_project_access(consultant_user_id);

CREATE INDEX IF NOT EXISTS idx_consultant_project_access_project 
ON consultant_project_access(project_id);

CREATE INDEX IF NOT EXISTS idx_consultant_project_access_org 
ON consultant_project_access(organization_id);

CREATE INDEX IF NOT EXISTS idx_consultant_project_access_status 
ON consultant_project_access(status);

-- Consultant access codes table (for reusable codes)
CREATE TABLE IF NOT EXISTS consultant_access_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    organization_id TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    
    -- Code config
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    expires_at DATETIME,
    
    -- What the code grants
    grants_free_seat INTEGER DEFAULT 1, -- If 1, consultant doesn't use org's seat pool
    
    -- Status
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, EXHAUSTED, REVOKED
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_consultant_access_codes_code 
ON consultant_access_codes(code);

CREATE INDEX IF NOT EXISTS idx_consultant_access_codes_org 
ON consultant_access_codes(organization_id);
















