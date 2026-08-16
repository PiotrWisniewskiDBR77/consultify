-- 20260912_claude_c_workbook_schema.sql
--
-- MAT-MVP-XLSX-001 (closure lane C, 2026-08-16) — canonicalizes into a real,
-- auditable migration the DDL that `ensureWorkbookSchema()`
-- (server/src/routes/workbook.routes.ts) and `ensureCommandStorage()`
-- (server/src/services/workbook/workbookCommandService.ts) used to each run
-- LAZILY, at request time, on the first call to any workbook endpoint.
--
-- VERIFIED VIOLATION (closure gate G3 — zero lazy/runtime DDL): after a full
-- strict `migrate.postgres.ts` replay against a fresh database, these four
-- tables did NOT exist —
--   generated_workbook_revisions
--   generated_workbook_comments
--   generated_workbook_source_bindings
--   generated_workbook_governance_events
-- — because nothing but the two runtime functions above ever created them.
-- That is the exact defect class that made `canvas_idea_materialization_receipts`
-- and `conversation_message_attachments` silently disappear from demo before
-- (see `944_canvas_idea_materialization_receipts.sql` / `canvasMaterialize.ts`
-- for the sibling fix this migration and `workbookSchemaGuard.ts` follow):
-- schema created only by application code is invisible to any migration
-- audit, and a future migration declaring the same table differently would
-- silently race the runtime `CREATE TABLE IF NOT EXISTS` for authority.
--
-- After this migration, `workbookSchemaGuard.ts` only ASSERTS these tables
-- exist (via `information_schema`) and throws loudly if this file was never
-- applied — no DDL fallback. `workbook.routes.ts` / `workbookCommandService.ts`
-- no longer contain a single `CREATE TABLE` / `ALTER TABLE`.
--
-- ORDERING TRAP (documented at `20260802_mat010_artifact_lineage.sql:22-33`,
-- reconfirmed here): `migrate.postgres.ts` applies migrations in plain
-- FILENAME STRING sort order, not date/semantic order — every `2026*`-named
-- file sorts BEFORE every bare 3-digit `7xx/9xx` file on a from-zero replay,
-- because '2' < '7' as the very first character. `generated_workbooks` itself
-- is declared by `756_interview_insight_downstream_lineage.sql`, which is a
-- 3-digit file and therefore is NOT guaranteed to have run before this one on
-- a fresh database. This file is therefore fully SELF-SUFFICIENT: every
-- statement is `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, and
-- NONE of the four new tables declare a foreign key to `generated_workbooks`
-- or to each other — exactly the guard pattern `20260802_mat006_workbook_lifecycle.sql`
-- already established for this same table (it re-declares
-- `CREATE TABLE IF NOT EXISTS generated_workbooks` itself, shape copied
-- verbatim from 756, rather than assuming 756 ran first). This file mirrors
-- that guard rather than depending on it.
--
-- Column/type/index shapes below are copied VERBATIM from the runtime DDL
-- being replaced (`ensureWorkbookSchema()` prior to this change) — no drift.

-- ---------------------------------------------------------------------------
-- Fresh-DB guard for generated_workbooks (mirrors 20260802_mat006's own
-- guard — see rationale above). No-op wherever 756 already ran.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_workbooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,
  schema_json TEXT,
  sheet_count INTEGER DEFAULT 1,
  file_name TEXT,
  file_size INTEGER,
  validation_errors TEXT,
  quality_score REAL,
  pipeline_log TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additive columns `ensureWorkbookSchema()` used to add on every request
-- (verbatim list/order/defaults from the removed runtime code).
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS action_contract_json TEXT DEFAULT '{}';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS source_pack_json TEXT DEFAULT '{}';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS evidence_refs_json TEXT DEFAULT '[]';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'internal';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'draft';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS approval_current INTEGER DEFAULT 0;
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS quality_report_json TEXT DEFAULT '{}';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS last_mutation_key TEXT;

-- Archive support (MAT-MVP-XLSX-001 task d — did not exist anywhere before).
-- Mirrors report_builder_reports.archived_at/archived_by
-- (932_report_builder_archive_columns.sql) column-for-column: reversible
-- (unarchive clears both back to NULL), never a delete.
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE INDEX IF NOT EXISTS idx_workbooks_org ON generated_workbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_workbooks_archived
  ON generated_workbooks(organization_id, archived_at);

-- ---------------------------------------------------------------------------
-- generated_workbook_revisions — command/cell/title/governance history.
-- Self-sufficient: no FK to generated_workbooks (see ordering trap above).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_workbook_revisions (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT,
  base_schema_json TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  operations_json TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workbook_id, organization_id, version)
);
CREATE INDEX IF NOT EXISTS idx_workbook_revisions_head
  ON generated_workbook_revisions(workbook_id, organization_id, version DESC);

-- ---------------------------------------------------------------------------
-- generated_workbook_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_workbook_comments (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  sheet_id TEXT,
  range_ref TEXT,
  anchored_version INTEGER NOT NULL DEFAULT 0,
  parent_comment_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  anchor_state TEXT NOT NULL DEFAULT 'active',
  idempotency_key TEXT,
  created_by TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workbook_id, organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_workbook_comments_scope
  ON generated_workbook_comments(workbook_id, organization_id, status, created_at);

-- ---------------------------------------------------------------------------
-- generated_workbook_source_bindings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_workbook_source_bindings (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  range_ref TEXT NOT NULL,
  label TEXT NOT NULL,
  source_ref TEXT,
  source_type TEXT,
  anchored_version INTEGER NOT NULL DEFAULT 0,
  anchor_state TEXT NOT NULL DEFAULT 'active',
  idempotency_key TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workbook_id, organization_id, idempotency_key)
);
-- Defensive additive column (matches the removed runtime code's own
-- defensive re-add) — a no-op once the CREATE TABLE above already ran.
ALTER TABLE generated_workbook_source_bindings
  ADD COLUMN IF NOT EXISTS anchor_state TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_workbook_source_bindings_scope
  ON generated_workbook_source_bindings(workbook_id, organization_id, sheet_id, range_ref);

-- ---------------------------------------------------------------------------
-- generated_workbook_governance_events — classification/lifecycle/archive
-- audit trail (POST/DELETE :id/archive, PATCH :id/governance).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_workbook_governance_events (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  previous_value TEXT,
  next_value TEXT NOT NULL,
  reason TEXT,
  workbook_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workbook_governance_events_scope
  ON generated_workbook_governance_events(workbook_id, organization_id, created_at DESC);
