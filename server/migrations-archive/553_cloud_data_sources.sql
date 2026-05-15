-- Migration 553: Cloud Data Sources
-- Tables for managing external cloud storage connections (Google Drive, OneDrive, etc.)

-- Needed for gen_random_uuid() used for TEXT ids
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cloud_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'onedrive', 'dropbox', 'sharepoint')),
  name TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  root_folder_id TEXT,
  settings TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'expired')),
  last_sync_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cloud_sources_org ON cloud_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_cloud_sources_user ON cloud_sources(user_id);

CREATE TABLE IF NOT EXISTS cloud_import_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cloud_source_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  result TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (cloud_source_id) REFERENCES cloud_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cloud_import_jobs_source ON cloud_import_jobs(cloud_source_id);
CREATE INDEX IF NOT EXISTS idx_cloud_import_jobs_org ON cloud_import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_cloud_import_jobs_status ON cloud_import_jobs(status);
