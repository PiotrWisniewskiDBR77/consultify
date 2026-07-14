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

-- =====================================================================
-- FRESH-DB PARITY (2026-07-14)
-- The 2026-05-xx "block" migrations (20260508_block_b_record_provenance,
-- 20260508_block_c_ai_operator §1, 20260509_block_c_qa_engine,
-- 20260510_block_c_source_pack, 20260512_block_d_table_conversions) sort
-- BEFORE this file on a fresh replay, so their tp_*-dependent DDL is skipped
-- (guarded on table existence). Re-apply that DDL here idempotently so the
-- final schema matches staging/prod. Every statement is a no-op wherever the
-- object already exists; this file is never re-run on already-migrated DBs.
-- =====================================================================

-- ---- Block B: tp_record_sources + tp_records provenance columns ------------
CREATE TABLE IF NOT EXISTS tp_record_sources (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          TEXT        NOT NULL,
  record_id                UUID        NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  source_type              TEXT        NOT NULL,
  source_uri               TEXT        NULL,
  source_metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  confidence_contribution  NUMERIC(3,2) NULL,
  created_by               TEXT        NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at         TIMESTAMPTZ NULL,
  last_verified_by         TEXT        NULL,
  archived_at              TIMESTAMPTZ NULL,

  CONSTRAINT tp_record_sources_source_type_check
    CHECK (source_type IN ('manual','document','presentation','external_api','ai_generated','imported')),
  CONSTRAINT tp_record_sources_confidence_range_check
    CHECK (confidence_contribution IS NULL OR (confidence_contribution >= 0.00 AND confidence_contribution <= 1.00))
);

CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record         ON tp_record_sources(record_id);
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_org            ON tp_record_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record_active  ON tp_record_sources(record_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_source_type    ON tp_record_sources(source_type);

ALTER TABLE tp_records
  ADD COLUMN IF NOT EXISTS confidence_score   NUMERIC(3,2) NULL,
  ADD COLUMN IF NOT EXISTS validation_status  TEXT         NOT NULL DEFAULT 'unverified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tp_records_confidence_range_check'
  ) THEN
    ALTER TABLE tp_records
      ADD CONSTRAINT tp_records_confidence_range_check
      CHECK (confidence_score IS NULL OR (confidence_score >= 0.00 AND confidence_score <= 1.00));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tp_records_validation_status_check'
  ) THEN
    ALTER TABLE tp_records
      ADD CONSTRAINT tp_records_validation_status_check
      CHECK (validation_status IN ('unverified', 'verified', 'flagged'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tp_records_validation_status
  ON tp_records(validation_status);

CREATE INDEX IF NOT EXISTS idx_tp_records_confidence_low
  ON tp_records(confidence_score)
  WHERE confidence_score IS NOT NULL AND confidence_score < 0.60;

-- ---- Block C §1: tp_schema_proposals.level ---------------------------------
ALTER TABLE tp_schema_proposals
  ADD COLUMN IF NOT EXISTS level TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tp_schema_proposals_level_check'
  ) THEN
    ALTER TABLE tp_schema_proposals
      ADD CONSTRAINT tp_schema_proposals_level_check
      CHECK (level IS NULL OR level IN (
        'cell','record','column','structure',
        'view','relational','methodological','source'
      ));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tp_schema_proposals_level
  ON tp_schema_proposals(level)
  WHERE level IS NOT NULL;

-- ---- Block C: QA engine tables ---------------------------------------------
CREATE TABLE IF NOT EXISTS tp_qa_reports (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        UUID         NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  organization_id TEXT         NOT NULL,
  workspace_id    TEXT         NOT NULL,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  computed_by     TEXT         NOT NULL,
  trigger_kind    TEXT         NOT NULL,
  overall_score   NUMERIC(4,3) NOT NULL,
  axes            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  suggestions     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  computation_ms  INTEGER      NULL,

  CONSTRAINT tp_qa_reports_overall_range_check
    CHECK (overall_score >= 0.000 AND overall_score <= 1.000),
  CONSTRAINT tp_qa_reports_trigger_check
    CHECK (trigger_kind IN ('on_demand','scheduled','record_write','migration'))
);

CREATE INDEX IF NOT EXISTS idx_tp_qa_reports_table_recent
  ON tp_qa_reports(table_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_qa_reports_org
  ON tp_qa_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_qa_reports_workspace
  ON tp_qa_reports(workspace_id);

CREATE TABLE IF NOT EXISTS tp_qa_suggestion_dismissals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        UUID        NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  organization_id TEXT        NOT NULL,
  fingerprint     TEXT        NOT NULL,
  reason          TEXT        NULL,
  dismissed_by    TEXT        NOT NULL,
  dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tp_qa_suggestion_dismissals_unique
    UNIQUE (table_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_tp_qa_dismissals_table
  ON tp_qa_suggestion_dismissals(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_qa_dismissals_org
  ON tp_qa_suggestion_dismissals(organization_id);

-- ---- Block C: source packs ---------------------------------------------------
CREATE TABLE IF NOT EXISTS tp_source_packs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      TEXT         NOT NULL,
  workspace_id         TEXT         NOT NULL,
  owner_user_id        TEXT         NOT NULL,
  table_id             UUID         NULL REFERENCES tp_tables(id) ON DELETE SET NULL,
  name                 TEXT         NOT NULL,
  description          TEXT         NULL,
  candidate_record_ids UUID[]       NOT NULL DEFAULT '{}',
  v8_snapshot          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  used_count           INTEGER      NOT NULL DEFAULT 0,
  archived_at          TIMESTAMPTZ  NULL,

  CONSTRAINT tp_source_packs_name_check
    CHECK (length(name) > 0 AND length(name) <= 200),
  CONSTRAINT tp_source_packs_used_count_check
    CHECK (used_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tp_source_packs_org
  ON tp_source_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_source_packs_workspace
  ON tp_source_packs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_source_packs_table
  ON tp_source_packs(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tp_source_packs_active
  ON tp_source_packs(organization_id, created_at DESC) WHERE archived_at IS NULL;

-- ---- Block D: table conversions ----------------------------------------------
CREATE TABLE IF NOT EXISTS tp_table_conversions (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     TEXT         NOT NULL,
  workspace_id        TEXT         NOT NULL,
  table_id            UUID         NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  source_pack_id      UUID         NULL REFERENCES tp_source_packs(id) ON DELETE SET NULL,
  target              TEXT         NOT NULL,
  title               TEXT         NULL,
  outline             JSONB        NULL,
  v8_snapshot         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT         NOT NULL,
  artifact_run_id     UUID         NULL,
  artifact_deep_link  TEXT         NULL,
  initiated_by        TEXT         NOT NULL,
  initiated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ  NULL,
  failure_reason      TEXT         NULL,
  failure_stage       TEXT         NULL,

  CONSTRAINT tp_table_conversions_target_check
    CHECK (target IN ('document','presentation')),
  CONSTRAINT tp_table_conversions_status_check
    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  CONSTRAINT tp_table_conversions_failure_stage_check
    CHECK (
      failure_stage IS NULL OR
      failure_stage IN ('snapshot','materialize','register','retry')
    )
);

CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_org
  ON tp_table_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_workspace
  ON tp_table_conversions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_table
  ON tp_table_conversions(table_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_source_pack
  ON tp_table_conversions(source_pack_id) WHERE source_pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_status
  ON tp_table_conversions(status, initiated_at DESC) WHERE status IN ('queued','running');
