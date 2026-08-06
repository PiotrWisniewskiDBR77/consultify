-- Strict runtime-order producer for permission requests consumed by 795.
CREATE TABLE IF NOT EXISTS permission_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    current_value TEXT,
    requested_value TEXT,
    justification TEXT,
    status TEXT DEFAULT 'PENDING',
    priority TEXT DEFAULT 'NORMAL',
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permission_requests_user ON permission_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_org ON permission_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
