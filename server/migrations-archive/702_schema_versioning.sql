-- ============================================
-- Table Platform Schema Versioning
-- Migration: 702_schema_versioning.sql
-- Description: Tracks schema version history per base
-- ============================================

CREATE TABLE IF NOT EXISTS tp_schema_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_summary JSONB NOT NULL DEFAULT '{}',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID
);

CREATE INDEX IF NOT EXISTS idx_schema_versions_base ON tp_schema_versions(base_id, version DESC);
