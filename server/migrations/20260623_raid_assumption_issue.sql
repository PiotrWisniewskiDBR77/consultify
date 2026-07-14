-- M14/F8 (8.2) — RAID governance: assumption validation + issue SLA + linked_items.
--
-- Brings ASSUMPTION and ISSUE RAID items into the governance fold:
--   * validation_status / validation_due_date  → assumptions become testable and overdue-trackable
--   * resolution_due_date                       → issues gain an SLA the governance engine can breach
--   * materialized_at                           → records when an ISSUE was materialized from a RISK
--                                                 (linked_items already exists on raid_items as the JSON link)
--
-- Postgres-safe: IF NOT EXISTS keeps this idempotent and re-runnable.

-- FRESH-DB GUARD (2026-07-14): raid_items is created by
-- 561_execution_control_t039_t040.sql, which sorts AFTER this file on a fresh
-- replay. Skip when the table does not exist yet; 561 re-applies these columns
-- and indexes idempotently, so the final schema is identical. No behaviour
-- change on already-migrated DBs.
DO $mig20260623raid$
BEGIN
IF to_regclass('public.raid_items') IS NOT NULL THEN

  ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS validation_status TEXT;      -- unvalidated | validated | invalidated
  ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS validation_due_date TEXT;    -- ISO date — assumption validation SLA
  ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS resolution_due_date TEXT;    -- ISO date — issue resolution SLA
  ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS materialized_at TEXT;        -- ISO timestamp — RISK→ISSUE materialization

  -- Governance scans filter by org + type + these date columns; index the hot path.
  CREATE INDEX IF NOT EXISTS idx_raid_items_validation
    ON raid_items (organization_id, type, validation_status)
    WHERE validation_status IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_raid_items_resolution_due
    ON raid_items (organization_id, type, resolution_due_date)
    WHERE resolution_due_date IS NOT NULL;

END IF;
END
$mig20260623raid$;
