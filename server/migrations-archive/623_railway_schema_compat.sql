-- Railway schema compatibility patch
-- Migration: 623_railway_schema_compat.sql
-- Date: 2026-03-04
--
-- Purpose:
-- Some Railway DBs lag behind the current backend expectations. This migration is additive
-- and uses IF NOT EXISTS to avoid destructive changes.

-- ------------------------------------------
-- Notifications: add organization_id
-- ------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Prefer project-based backfill when possible.
UPDATE notifications n
SET organization_id = p.organization_id
FROM projects p
WHERE n.organization_id IS NULL
  AND n.project_id = p.id;

-- Fallback backfill from user profile.
UPDATE notifications n
SET organization_id = u.organization_id
FROM users u
WHERE n.organization_id IS NULL
  AND n.user_id = u.id;

CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_org ON notifications(user_id, organization_id);

-- ------------------------------------------
-- Organization billing: add subscription_plan_id
-- ------------------------------------------
ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS subscription_plan_id TEXT;

UPDATE organization_billing ob
SET subscription_plan_id = COALESCE(ob.subscription_plan_id, o.plan)
FROM organizations o
WHERE ob.subscription_plan_id IS NULL
  AND ob.organization_id = o.id;

-- ------------------------------------------
-- Cloud sources: create missing tables
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS cloud_sources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  root_folder_id TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cloud_sources_org ON cloud_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_cloud_sources_org_created ON cloud_sources(organization_id, created_at);

CREATE TABLE IF NOT EXISTS cloud_import_jobs (
  id TEXT PRIMARY KEY,
  cloud_source_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cloud_import_jobs_org ON cloud_import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_cloud_import_jobs_source ON cloud_import_jobs(cloud_source_id);

CREATE TABLE IF NOT EXISTS cloud_sync_log (
  id TEXT PRIMARY KEY,
  cloud_source_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  items_processed INTEGER,
  items_created INTEGER,
  items_failed INTEGER,
  error_message TEXT,
  metadata_json TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cloud_sync_log_org ON cloud_sync_log(organization_id);
