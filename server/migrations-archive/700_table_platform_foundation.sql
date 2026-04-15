-- ============================================
-- Table Platform Foundation
-- Migration: 700_table_platform_foundation.sql
-- Description: Creates the metadata-first table platform schema
-- ============================================

-- Bases: collection of related tables within a workspace
CREATE TABLE IF NOT EXISTS tp_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  schema_version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_bases_workspace ON tp_bases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_bases_org ON tp_bases(organization_id);

-- Tables: structured data containers with schema
CREATE TABLE IF NOT EXISTS tp_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  primary_field_id UUID,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_tables_base ON tp_tables(base_id);

-- Fields: column definitions with type and options
CREATE TABLE IF NOT EXISTS tp_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '{}',
  is_computed BOOLEAN NOT NULL DEFAULT FALSE,
  field_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(table_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tp_fields_table ON tp_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_fields_type ON tp_fields(table_id, field_type);

-- Views: saved query configurations
CREATE TABLE IF NOT EXISTS tp_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Grid view',
  view_type TEXT NOT NULL DEFAULT 'grid',
  visible_field_ids UUID[] NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_views_table ON tp_views(table_id);

-- Records: data rows with JSONB payload
CREATE TABLE IF NOT EXISTS tp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_records_table ON tp_records(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_records_data ON tp_records USING GIN (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_tp_records_created ON tp_records(table_id, created_at DESC);

-- Record links: bidirectional relations between records
CREATE TABLE IF NOT EXISTS tp_record_links (
  from_record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  from_field_id UUID NOT NULL REFERENCES tp_fields(id) ON DELETE CASCADE,
  to_record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_record_id, from_field_id, to_record_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_record_links_to ON tp_record_links(to_record_id);
CREATE INDEX IF NOT EXISTS idx_tp_record_links_field ON tp_record_links(from_field_id);

-- Attachments: file metadata
CREATE TABLE IF NOT EXISTS tp_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES tp_fields(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  thumbnails JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_attachments_record ON tp_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_tp_attachments_field ON tp_attachments(field_id);

-- Audit events: immutable log of mutations
CREATE TABLE IF NOT EXISTS tp_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_audit_entity ON tp_audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tp_audit_actor ON tp_audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_tp_audit_type ON tp_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tp_audit_created ON tp_audit_events(created_at DESC);

-- Schema proposals: chat-to-schema proposals
CREATE TABLE IF NOT EXISTS tp_schema_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_proposals_workspace ON tp_schema_proposals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_proposals_status ON tp_schema_proposals(status);
