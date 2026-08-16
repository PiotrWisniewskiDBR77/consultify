-- Lane C (closure) — MAT-MVP-DOC-001 / MAT-BVP-001, part (a): explicit
-- content-addressable lineage for `document_version_snapshots`.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────
-- `document_version_snapshots` (created by `776_document_studio_wave5_
-- persistence.sql`) has no content hash and no persisted parent pointer.
-- Contrast `knowledge_doc_versions.content_hash`, which already carries
-- one. Without a hash there is no way to detect a tampered or duplicated
-- version, or to prove a downstream export corresponds to a specific
-- revision. Without a persisted `parent_version_id`, lineage is only
-- reconstructable by `version_number` ordering — `documentVersionSnapshot
-- Service.ts`'s `createDocumentVersionSnapshot` already COMPUTES the
-- previous version in memory (`previousSnapshot`), but only writes it into
-- the audit entry's JSON `details`, never onto the snapshot row itself.
--
-- This migration adds both columns, additively, plus the indexes that make
-- "walk the parent chain" and "find snapshots by content hash" cheap.
--
-- ── FRESH-DB GUARD (migration-ordering) ────────────────────────────────
-- `server/scripts/migrationOrdering.ts` sorts migrations into phases:
-- NUMBERED filenames (e.g. `776_...`) are phase 0, DATED filenames (e.g.
-- this file, `20260912_...`) are phase 1 unless explicitly overridden into
-- `EARLY_VERSION_OVERRIDES`/`LATE_PHASE_SET`. Phase 0 runs entirely before
-- phase 1, so under the CURRENT runner `776_document_studio_wave5_
-- persistence.sql` (phase 0) already runs before this file (phase 1,
-- unoverridden) on a fresh database — `document_version_snapshots` should
-- already exist by the time this file runs.
--
-- However: `20260802_mat010_artifact_lineage.sql` and `20260802_mat010_
-- lineage_pending_events.sql` document an OLDER, naive-filename-string-sort
-- ordering trap ('2' < '7', so every `2026*` file used to run BEFORE every
-- 3-digit `7xx/8xx/9xx` file) that `migrationOrdering.ts` was written to
-- fix. This file does not assume either behavior is the permanent truth —
-- it is written to be correct under BOTH orderings, verified by an actual
-- fresh-database `migrate.postgres.ts` run (not by assumption):
--
--   * If `document_version_snapshots` does NOT exist yet when this file
--     runs (naive-sort ordering), the DO block below creates the table
--     itself — with the SAME shape `776_...` creates PLUS the two new
--     columns and the same-named indexes `776_...` also creates. When
--     `776_...` runs afterwards, its `CREATE TABLE IF NOT EXISTS` /
--     `CREATE INDEX IF NOT EXISTS` statements become safe no-ops against
--     the table this file already created.
--   * If `document_version_snapshots` already exists (phase-aware
--     ordering, or any replay after `776_...` has already applied), the DO
--     block is a no-op and the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
--     statements below do the real column-adding work.
--
-- Either way, by the time this migration's statements finish, the table
-- exists with both new columns and both new indexes. No foreign key is
-- added (self-referencing `parent_version_id` stays a plain indexed column,
-- matching the repo's existing idiom of omitting FKs across migrations
-- that must stay order-independent — see `20260802_mat010_artifact_
-- lineage.sql`'s own comment on the same point).
--
-- Every statement is IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so
-- re-running this file (repeat-run, `--dry-run` after apply) is a no-op.

DO $$
BEGIN
  IF to_regclass('public.document_version_snapshots') IS NULL THEN
    CREATE TABLE document_version_snapshots (
      version_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      captured_at TEXT NOT NULL,
      captured_by TEXT NOT NULL,
      label TEXT,
      reason TEXT,
      status_at_capture TEXT NOT NULL,
      schema_json JSONB NOT NULL DEFAULT '{}',
      origin TEXT NOT NULL DEFAULT 'manual',
      -- The two columns this migration exists to add — included here too
      -- so a fresh-DB run that hits this branch never produces a table
      -- missing them (see FRESH-DB GUARD above).
      content_hash TEXT,
      parent_version_id TEXT
    );

    -- Same names as `776_document_studio_wave5_persistence.sql` so that
    -- file's later `CREATE INDEX IF NOT EXISTS` calls are no-ops, not
    -- duplicate indexes under different names.
    CREATE INDEX idx_dvs_artifact ON document_version_snapshots(artifact_id, version_number ASC);
    CREATE INDEX idx_dvs_org ON document_version_snapshots(organization_id);
    CREATE UNIQUE INDEX idx_dvs_artifact_version ON document_version_snapshots(artifact_id, version_number);
  END IF;
END $$;

-- Real column-adding work on an already-existing table (776 already
-- applied). No-op when the DO block above just created the table with
-- these columns already present.
ALTER TABLE document_version_snapshots ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE document_version_snapshots ADD COLUMN IF NOT EXISTS parent_version_id TEXT;

-- Lineage-chain walk: "find the snapshot whose parent_version_id = X".
CREATE INDEX IF NOT EXISTS idx_dvs_parent_version ON document_version_snapshots(parent_version_id);

-- Duplicate/tamper detection: "has this exact content already been
-- captured for this artifact". Scoped by artifact_id (not global) since
-- two different documents legitimately sharing byte-identical content is
-- not a defect.
CREATE INDEX IF NOT EXISTS idx_dvs_content_hash ON document_version_snapshots(artifact_id, content_hash);
