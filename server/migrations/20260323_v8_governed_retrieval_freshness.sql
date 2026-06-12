-- V8 Governed Retrieval — freshness tracking extensions
-- WP-20W3-02 + WP-20W3-03: ACL enforcement, freshness runtime, scope traceability

ALTER TABLE v8_retrieval_requests ADD COLUMN IF NOT EXISTS freshness_checked_at TEXT;
ALTER TABLE v8_retrieval_requests ADD COLUMN IF NOT EXISTS pipeline_result TEXT;
CREATE INDEX IF NOT EXISTS idx_v8_ret_req_org_date ON v8_retrieval_requests(organization_id, created_at);
