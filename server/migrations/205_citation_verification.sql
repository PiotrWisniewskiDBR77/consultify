-- Citation Verification Logs Table
-- Tracks citation accuracy metrics for RAG responses
-- Part of RAG Excellence - Phase 1.4

CREATE TABLE IF NOT EXISTS citation_verification_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    user_id TEXT,
    response_id TEXT,
    total_citations INTEGER DEFAULT 0,
    verified_citations INTEGER DEFAULT 0,
    accuracy REAL DEFAULT 0.0,
    quality_level TEXT,
    issues TEXT,  -- JSON array of issues
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_citation_verification_org_id ON citation_verification_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_citation_verification_created_at ON citation_verification_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_citation_verification_quality ON citation_verification_logs (quality_level);




