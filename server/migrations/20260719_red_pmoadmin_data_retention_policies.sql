-- RED-D W5/W6 (2026-07-19): GET /api/superadmin/compliance/retention-policies → 500.
-- Root cause #1 (DI): shared.ts wired DataRetentionService to a phantom stub with
-- getPolicy() (singular) while SuperAdminController.getDataRetentionPolicies calls
-- getPolicies() (plural) → "deps.DataRetentionService.getPolicies is not a function".
-- Fixed in code (server/src/services/dataRetentionAdminService.ts + shared.ts wiring).
-- Root cause #2 (schema): the real backing table is missing on this environment.
-- It is defined in two legacy sources that never autorun here — the live migration
-- runner only matches /^(7\d{2}|\d{8})_.*\.sql$/:
--   server/migrations/015_enterprise_customers_module.sql (SQLite-only DATETIME/INTEGER-bool)
--   server/migrations-v2/001_baseline_20260413.sql (pg_dump snapshot — same columns)
-- This migration recreates the identical column set, Postgres-safe, idempotent.
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  retention_days INTEGER NOT NULL,
  auto_delete INTEGER DEFAULT 0,
  archive_before_delete INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_org ON data_retention_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_retention_policies_type ON data_retention_policies(data_type);
