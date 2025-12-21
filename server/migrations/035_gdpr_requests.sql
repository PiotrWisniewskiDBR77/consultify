-- 035_gdpr_requests.sql
-- Tracking for Data Subject Access Requests (DSAR) and Right to be Forgotten

CREATE TABLE gdpr_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('EXPORT', 'DELETION')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
    result_url TEXT, -- API link to download the export (temporary)
    expires_at DATETIME, -- For export download link
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gdpr_requests_user ON gdpr_requests(user_id);
CREATE INDEX idx_gdpr_requests_status ON gdpr_requests(status);
