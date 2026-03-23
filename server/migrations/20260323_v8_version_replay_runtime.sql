-- V8 Version/Replay/Audit Spine — Runtime Extensions (Wave 8)
-- Adds AI-generated flag and optimized indexes for replay runtime queries.

ALTER TABLE v8_version_snapshots ADD COLUMN is_ai_generated INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_v8_snapshots_resource
  ON v8_version_snapshots(resource_id, organization_id, version_number);

CREATE INDEX IF NOT EXISTS idx_v8_restores_pending
  ON v8_restore_requests(organization_id, status) WHERE status = 'pending';
