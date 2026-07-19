-- Migration: 609_cloud_sync_log_v3.sql
-- Purpose: Always-on audit log for cloud publish/uploads (V3-M04)
-- Date: 2026-02-27

CREATE TABLE IF NOT EXISTS cloud_sync_log (
  id TEXT PRIMARY KEY,
  cloud_source_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'push', -- push | pull
  status TEXT NOT NULL,                  -- success | failed | partial
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata_json TEXT DEFAULT '{}',
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cloud_sync_log_org ON cloud_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_log_source ON cloud_sync_log(cloud_source_id);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_log_created ON cloud_sync_log(created_at);

