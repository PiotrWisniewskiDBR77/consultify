-- Organization Switch Audit Log
-- Tracks when users switch between organizations for security and analytics

CREATE TABLE IF NOT EXISTS organization_switch_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_organization_id TEXT,
    to_organization_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (from_organization_id) REFERENCES organizations(id),
    FOREIGN KEY (to_organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_org_switch_log_user ON organization_switch_log(user_id);
CREATE INDEX IF NOT EXISTS idx_org_switch_log_to_org ON organization_switch_log(to_organization_id);
CREATE INDEX IF NOT EXISTS idx_org_switch_log_created ON organization_switch_log(created_at);

CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT')),
    status TEXT DEFAULT 'ACTIVE',
    invited_by_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Backfill: ensure all existing users have an organization_members row
-- This covers users created before the multi-org feature was added
INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
SELECT
    gen_random_uuid()::TEXT,
    u.organization_id,
    u.id,
    CASE WHEN u.role IN ('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN') THEN 'OWNER' ELSE 'MEMBER' END,
    'ACTIVE',
    COALESCE(u.created_at, CURRENT_TIMESTAMP)
FROM users u
WHERE u.organization_id IS NOT NULL
  AND u.organization_id != ''
  AND NOT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.user_id = u.id AND m.organization_id = u.organization_id
  )
ON CONFLICT (organization_id, user_id) DO NOTHING;
