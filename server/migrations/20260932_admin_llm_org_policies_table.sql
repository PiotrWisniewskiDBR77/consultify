CREATE TABLE IF NOT EXISTS llm_org_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    mode TEXT,
    review_state TEXT,
    internet_enabled INTEGER DEFAULT 0,
    audit_required INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_llm_org_policies_org_updated
    ON llm_org_policies(organization_id, updated_at DESC);
