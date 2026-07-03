-- Migration 787: initiative lifecycle schema repair (golden-path probe, R3)
--
-- Live-demo probing of the M13→M14→M15 chain surfaced schema drift on
-- deployments initialized before the lifecycle columns were introduced:
--
--   1. `initiatives.completed_at` (plus done_at/done_by) missing → the
--      M14→M15 closure-handoff inbox read (v8 results `/benefits/inbox`)
--      42703'd and fail-softed to an EMPTY inbox, making the handoff look
--      dead even though the writer works.
--   2. `initiative_kpis.progress_percentage` / `status` / `trend_data`
--      missing → the KPI-assignment read-back after POST
--      /api/initiatives/:id/kpis 42703'd → 500 on every KPI create.
--
-- Readers are now schema-aware (fail-safe), and this migration heals the
-- schema itself so lifecycle timestamps actually persist. Additive-only,
-- idempotent.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS done_at TIMESTAMP;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS done_by TEXT;

ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS progress_percentage REAL DEFAULT 0;
ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE initiative_kpis ADD COLUMN IF NOT EXISTS trend_data TEXT;
