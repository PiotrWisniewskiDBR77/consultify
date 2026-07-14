-- Migration 767: Presentation Template Registry Governance (Epic C2)
--
-- Adds a lifecycle (`draft` / `approved` / `deprecated`), an approval
-- audit trail, and a parent/root/version lineage chain to
-- `presentation_templates`. This is additive only — no existing
-- columns are dropped or rewritten and existing system templates
-- (with text IDs like `pt-steering`) keep working unchanged.
--
-- Lineage columns are TEXT rather than UUID because the existing
-- `presentation_templates.id` is `TEXT PRIMARY KEY` (it stores both
-- gen_random_uuid()::text AND human-readable IDs like `pt-steering`).
-- A UUID type here would refuse to store the existing seed IDs.
--
-- Schema-tolerant code path: routes / services swallow missing column
-- and missing table errors and return `storage_error` /
-- `migration_pending` instead of 500-ing.

-- ============================================================
-- LIFECYCLE COLUMNS
-- ============================================================

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS deprecated_by TEXT;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS deprecation_reason TEXT;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS lineage_parent_id TEXT;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS lineage_root_id TEXT;

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS lineage_version INTEGER NOT NULL DEFAULT 1;

-- Constrain lifecycle_state values via a CHECK constraint, but only
-- if it has not already been added (idempotent re-runs must succeed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'presentation_templates'
      AND constraint_name = 'presentation_templates_lifecycle_state_check'
  ) THEN
    ALTER TABLE presentation_templates
      ADD CONSTRAINT presentation_templates_lifecycle_state_check
      CHECK (lifecycle_state IN ('draft', 'approved', 'deprecated'));
  END IF;
END$$;

-- Pre-existing system templates seeded by migration 568 are
-- production-grade and should be considered approved by default so
-- they remain selectable by the existing /templates route.
UPDATE presentation_templates
   SET lifecycle_state = 'approved',
       approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
       approved_by = COALESCE(approved_by, 'system')
 -- is_system is INTEGER on the live schema but BOOLEAN when created fresh by
 -- 568_presentations_brand_kits_templates.sql — cast makes the predicate work
 -- on both (2026-07-14 fresh-replay fix; boolean::int → 1/0 in Postgres).
 WHERE is_system::int = 1
   AND lifecycle_state = 'draft';

-- Backfill lineage_root_id for every existing row so each template is
-- the root of its own (single-element) lineage chain. Subsequent
-- clones extend the chain via computeLineageForClone().
UPDATE presentation_templates
   SET lineage_root_id = COALESCE(lineage_root_id, id)
 WHERE lineage_root_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_presentation_templates_lifecycle
  ON presentation_templates(organization_id, lifecycle_state);

CREATE INDEX IF NOT EXISTS idx_presentation_templates_lineage_root
  ON presentation_templates(lineage_root_id)
  WHERE lineage_root_id IS NOT NULL;

-- ============================================================
-- AUDIT LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS presentation_template_governance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'submitted_for_approval',
    'approved',
    'rejected',
    'deprecated',
    'cloned',
    'reverted'
  )),
  from_state TEXT,
  to_state TEXT,
  actor_id TEXT,
  actor_role TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_governance_events_template
  ON presentation_template_governance_events(template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_governance_events_org
  ON presentation_template_governance_events(organization_id, created_at DESC);
