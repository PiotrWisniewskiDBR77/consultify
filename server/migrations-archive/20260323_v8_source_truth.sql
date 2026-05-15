-- V8 Source Truth Preservation — WP-W3-LIFECYCLE-01
-- Tracks how upstream artifacts become initiatives while preserving origin,
-- evidence, and context traceability.
--
-- Decisions applied:
--   W3-1 — invisible materialization by default
--   W3-2 — dual-gate promotion (permission + evidence)
--   W3-3 — synced_source_refs at initiative governance level

-- Source materialization records: how each source became an initiative
CREATE TABLE IF NOT EXISTS v8_source_materialization_records (
  record_id              TEXT PRIMARY KEY,
  initiative_id          TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  entrypoint             TEXT NOT NULL CHECK (entrypoint IN ('idea', 'interview', 'tools_assessment', 'chat', 'manual')),
  entrypoint_class       TEXT NOT NULL CHECK (entrypoint_class IN ('native_source', 'derived_source')),
  source_artifact_id     TEXT NOT NULL,
  source_artifact_type   TEXT NOT NULL,
  context_snapshot_id    TEXT,
  materialization_mode   TEXT NOT NULL DEFAULT 'invisible' CHECK (materialization_mode IN ('invisible', 'explicit_confirmation')),
  evidence_class         TEXT NOT NULL CHECK (evidence_class IN ('strong', 'moderate', 'weak', 'mixed')),
  promoted_by            TEXT NOT NULL,
  promoted_at            TEXT NOT NULL DEFAULT (datetime('now')),
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_src_mat_org        ON v8_source_materialization_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_src_mat_initiative  ON v8_source_materialization_records(initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_src_mat_entrypoint  ON v8_source_materialization_records(entrypoint);
CREATE INDEX IF NOT EXISTS idx_v8_src_mat_promoted_by ON v8_source_materialization_records(promoted_by);
CREATE INDEX IF NOT EXISTS idx_v8_src_mat_snapshot    ON v8_source_materialization_records(context_snapshot_id) WHERE context_snapshot_id IS NOT NULL;

-- Synced source refs: external source lineage at initiative level (Decision W3-3)
CREATE TABLE IF NOT EXISTS v8_synced_source_refs (
  ref_id              TEXT PRIMARY KEY,
  initiative_id       TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  external_source_id  TEXT NOT NULL,
  external_system     TEXT NOT NULL,
  sync_status         TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'stale', 'disconnected', 'error')),
  last_synced_at      TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_sync_ref_org        ON v8_synced_source_refs(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_sync_ref_initiative  ON v8_synced_source_refs(initiative_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_sync_ref_system      ON v8_synced_source_refs(external_system);
CREATE INDEX IF NOT EXISTS idx_v8_sync_ref_status      ON v8_synced_source_refs(sync_status);
