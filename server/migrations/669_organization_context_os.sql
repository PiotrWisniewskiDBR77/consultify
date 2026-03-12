-- ORGANIZATION-CONTEXT-OS-001
-- Append-only organization context store + claims + resolved snapshots.

CREATE TABLE IF NOT EXISTS organization_context_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    author_user_id TEXT,
    channel TEXT DEFAULT 'system',
    source_label TEXT,
    content_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT DEFAULT '{}',
    is_explicit INTEGER DEFAULT 1,
    visibility_scope TEXT DEFAULT 'organization',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_ctx_items_org
    ON organization_context_items(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_ctx_items_source
    ON organization_context_items(organization_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS organization_context_claims (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    claim_path TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    confidence REAL DEFAULT 1.0,
    claim_type TEXT DEFAULT 'fact',
    status TEXT DEFAULT 'active',
    review_status TEXT DEFAULT 'accepted',
    supersedes_claim_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES organization_context_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_ctx_claims_org
    ON organization_context_claims(organization_id, claim_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_ctx_claims_item
    ON organization_context_claims(item_id);

CREATE TABLE IF NOT EXISTS organization_context_snapshots (
    organization_id TEXT PRIMARY KEY,
    schema_version INTEGER DEFAULT 1,
    snapshot_json TEXT NOT NULL DEFAULT '{}',
    rebuilt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_ctx_snapshots_rebuilt
    ON organization_context_snapshots(rebuilt_at DESC);
