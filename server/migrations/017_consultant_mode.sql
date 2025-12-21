-- Consultant Mode Tables

-- 1. Consultants Table
CREATE TABLE IF NOT EXISTS consultants (
    id TEXT PRIMARY KEY, -- user_id
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id) REFERENCES users(id)
);

-- 2. Consultant-Org Links (Multi-Org Access)
CREATE TABLE IF NOT EXISTS consultant_org_links (
    id TEXT PRIMARY KEY,
    consultant_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    role_in_org TEXT DEFAULT 'CONSULTANT',
    permission_scope TEXT, -- JSON blob for granular permissions
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, REVOKED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    FOREIGN KEY (consultant_id) REFERENCES consultants(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_consultant_links_consultant ON consultant_org_links(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_links_org ON consultant_org_links(organization_id);

-- 3. Consultant Invites (For tracking invites sent BY consultants)
CREATE TABLE IF NOT EXISTS consultant_invites (
    id TEXT PRIMARY KEY,
    consultant_id TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    target_email TEXT,
    target_company_name TEXT,
    invite_type TEXT NOT NULL, -- TRIAL_ORG, TRIAL_USER, ORG_ADD_CONSULTANT
    expires_at DATETIME NOT NULL,
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultant_id) REFERENCES consultants(id)
);

CREATE INDEX IF NOT EXISTS idx_consultant_invites_code ON consultant_invites(invite_code);

-- 4. Organization Enhancements (AI + Attribution)
-- Using a safe block if possible, but SQLite ALTER TABLE is limited.
-- We assume these columns don't exist yet as this is a new feature.

ALTER TABLE organizations ADD COLUMN ai_assertiveness_level TEXT DEFAULT 'MEDIUM';
ALTER TABLE organizations ADD COLUMN ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY';
ALTER TABLE organizations ADD COLUMN attribution_data TEXT;
