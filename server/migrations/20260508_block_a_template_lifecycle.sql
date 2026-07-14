-- Block A — Template Lifecycle (EPIC-T6)
-- Adds status / version / owner / approval_history / governance_rules columns to tp_base_templates
-- and promotes the 3 legacy featured templates (CRM Pipeline, Project Tracker, HR Onboarding)
-- from is_featured=true → status='approved'.
--
-- Idempotent: each column add and constraint is guarded.
-- Reversal: see migrations/rollback/20260508_block_a_template_lifecycle_rollback.sql
--
-- CTO decisions: 00_CTO_DECISIONS.md Q3 (lifecycle), Q7 (auto-promote 3 legacy).
-- Spec: tabele-full-product/block-A-template-catalog/evidence/sprint-0/migration-plan-signoff.md
--
-- FRESH-DB GUARD (2026-07-14): tp_base_templates is created by 721_templates.sql,
-- which sorts AFTER this file on a fresh replay. The whole body is therefore guarded
-- on table existence; 721 re-applies the lifecycle columns/constraint/indexes/promotion
-- idempotently, so the final schema is identical. No behaviour change on DBs where the
-- table already existed (staging/prod).

BEGIN;

DO $mig20260508$
BEGIN
IF to_regclass('public.tp_base_templates') IS NOT NULL THEN

  -- 1) Add lifecycle columns. owner_user_id is TEXT (matches existing created_by TEXT
  --    convention in tp_base_templates; no FK to users(id) per S0-F2).
  ALTER TABLE tp_base_templates
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS governance_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

  -- 2) Constrain status to the lifecycle vocabulary.
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tp_base_templates_status_check'
  ) THEN
    ALTER TABLE tp_base_templates
      ADD CONSTRAINT tp_base_templates_status_check
      CHECK (status IN ('draft', 'approved', 'deprecated'));
  END IF;

  -- 3) Lookup indexes (non-CONCURRENTLY; tp_base_templates is small — typically <1000 rows).
  CREATE INDEX IF NOT EXISTS idx_tp_templates_status     ON tp_base_templates(status);
  CREATE INDEX IF NOT EXISTS idx_tp_templates_owner_user ON tp_base_templates(owner_user_id) WHERE owner_user_id IS NOT NULL;

  -- 4) Promote legacy featured templates to 'approved' (CTO Q7).
  --    Only flips rows that are still 'draft' to keep the migration idempotent on re-runs.
  UPDATE tp_base_templates
     SET status           = 'approved',
         owner_user_id    = COALESCE(owner_user_id, 'system:legacy-promoted-2026-05-08'),
         approval_history = approval_history || jsonb_build_array(jsonb_build_object(
           'event',     'auto_promoted_from_legacy_featured',
           'at',        now(),
           'actor',     'migration:20260508_block_a_template_lifecycle',
           'note',      'Auto-promoted because is_featured=true at migration time. CTO Q7 (2026-05-08).',
           'previous_status', status
         ))
   WHERE is_featured = true
     AND status      = 'draft';

END IF;
END
$mig20260508$;

COMMIT;
