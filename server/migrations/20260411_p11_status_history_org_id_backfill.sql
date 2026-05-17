-- P11 §2.3.2 / AC-02: Ensure initiative_status_history has organization_id for multi-tenant audit queries.
-- Migration 549 handles PostgreSQL; this covers SQLite dev schemas created by 061 (which lacked org_id).
-- Idempotent: column add is guarded; backfill only touches NULL rows.

CREATE TABLE IF NOT EXISTS initiative_status_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    organization_id TEXT,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT,
    reason TEXT,
    gate_type TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
