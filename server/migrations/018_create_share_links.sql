-- Migration: Create Share Links Table
-- Description: Table for storing shareable report links with immutable snapshots

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('ORG_REPORT', 'INITIATIVE_REPORT')),
    entity_id TEXT,
    token TEXT NOT NULL UNIQUE,
    snapshot_json TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for fast token lookup (public access)
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

-- Index for listing user's share links
CREATE INDEX IF NOT EXISTS idx_share_links_org ON share_links(organization_id);

COMMIT;
