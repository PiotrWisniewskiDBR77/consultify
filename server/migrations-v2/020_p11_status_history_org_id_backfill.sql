-- Ported from: 20260411_p11_status_history_org_id_backfill.sql (SQLite idioms fixed for Postgres)
-- P11 §2.3.2 / AC-02: Ensure initiative_status_history has organization_id for multi-tenant audit queries.
-- Migration 549 handles PostgreSQL; this covers SQLite dev schemas created by 061 (which lacked org_id).
-- Idempotent: column add is guarded; backfill only touches NULL rows.

-- SQLite: ALTER TABLE ADD COLUMN is a no-op if column exists (will error, caught by runner).
-- PostgreSQL: 549 already handled this, but this is safe to re-run.

ALTER TABLE initiative_status_history ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Backfill from initiatives table where NULL
UPDATE initiative_status_history
SET organization_id = (
  SELECT i.organization_id
  FROM initiatives i
  WHERE i.id = initiative_status_history.initiative_id
)
WHERE organization_id IS NULL;

-- Index for org-scoped queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_initiative_status_history_org_id
    ON initiative_status_history(organization_id);
