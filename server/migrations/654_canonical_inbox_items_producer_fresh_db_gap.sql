-- Migration: 654_canonical_inbox_items_producer_fresh_db_gap.sql
-- Purpose: strict-schema repair (2026-08).
--
-- `canonical_inbox_items` (V4-INBX-01: canonical inbox item schema, MW-07 /
-- My Work "inbox") is used live by server/src/services/inboxService.ts,
-- server/src/services/inboxEnterpriseService.ts, server/src/routes/my-work.routes.ts,
-- server/src/routes/v8/my-work.routes.ts, server/src/services/v8/financeIntegrationHooks.ts
-- — it is real, active MVP runtime schema, not dead code.
--
-- Its only CREATE TABLE lives in server/migrations/never-ran/654_v4_canonical_inbox.sql,
-- which is deliberately excluded from every migration runner (see
-- never-ran/README_6xx.md): non-recursive `readdirSync()` never sees the
-- never-ran/ subdirectory, and the boot-time `runTablePlatformMigrations()`
-- pattern `/^(7\d{2}|\d{8})_.*\.sql$/` would not match a `654_` prefix
-- anyway. The 2026-07-19/20 audit documented there (E-MIG6XX) found the
-- table's content already live on the real demo/staging database (created
-- historically via a manual `npm run db:migrate` run before the boot regex
-- was narrowed to 7xx-only) — i.e. this is a genuine "fresh DB never gets
-- this table" gap, not a dead/legacy table.
--
-- Content below is copied verbatim from never-ran/654_v4_canonical_inbox.sql
-- (same columns/indexes) — not invented. Fully additive: CREATE TABLE IF NOT
-- EXISTS / CREATE INDEX IF NOT EXISTS throughout, no external FK, so this is
-- a safe no-op on any DB (including live demo/staging) where the table
-- already exists.
--
-- Numbered 654 (its original, never-applied number) so it sorts, in phase 0
-- numeric order, before its only strict-path consumers:
-- 736_inbox_performance_indexes.sql and 932_canonical_inbox_items_source_status_initiative.sql.

CREATE TABLE IF NOT EXISTS canonical_inbox_items (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  section TEXT NOT NULL DEFAULT 'assigned_tasks',
  status TEXT NOT NULL DEFAULT 'pending',
  sla_deadline TIMESTAMPTZ,
  sla_status TEXT DEFAULT 'on_track',
  delegated_to TEXT,
  delegated_at TIMESTAMPTZ,
  delegated_by TEXT,
  delegation_notes TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(user_id, source_entity_type, source_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_inbox_user ON canonical_inbox_items(user_id);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_org ON canonical_inbox_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_status ON canonical_inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_section ON canonical_inbox_items(section);
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_sla ON canonical_inbox_items(sla_deadline) WHERE sla_status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_canonical_inbox_delegated ON canonical_inbox_items(delegated_to) WHERE delegated_to IS NOT NULL;
