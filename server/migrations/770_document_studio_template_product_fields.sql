-- Migration 770: Consultify Document Studio — Template Product Fields
--
-- Slice E14.persistence: persists the 8 "product" fields on
-- DocumentTemplate that were added as substrate fields in
-- documentStudioTypes.ts but never wired into the registry DAO.
--
-- Powers:
--   - the FE-E2 template picker's "popular / recommended" sort
--     (usage_count + last_used_at);
--   - quality-aware ranking (feedback_quality_score +
--     feedback_sample_size);
--   - recommender filters by persona / region / brand / dependency
--     tags (persona_tags, region_tags, brand_tags, dependency_tags).
--
-- Additive + idempotent: every column is `ADD COLUMN IF NOT EXISTS`
-- with a default that preserves backwards compatibility (legacy rows
-- retain `NULL` for usage / feedback fields and `[]` for tag arrays).
--
-- The audit action CHECK constraint is also widened to accept the
-- two new actions emitted by recordTemplateUsage() and
-- recordTemplateFeedback() — `template_usage_recorded` and
-- `template_feedback_recorded`.

-- ============================================================
-- TEMPLATE TABLE — additive columns
-- ============================================================

ALTER TABLE document_studio_templates
  ADD COLUMN IF NOT EXISTS usage_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_quality_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS feedback_sample_size INTEGER,
  ADD COLUMN IF NOT EXISTS persona_tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS region_tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dependency_tags JSONB DEFAULT '[]'::jsonb;

-- Recommender index: sort by `last_used_at` (recently-used) within
-- a tenant. Partial index on rows that actually carry the field so
-- legacy NULL rows don't bloat the b-tree.
CREATE INDEX IF NOT EXISTS idx_document_studio_templates_org_last_used
  ON document_studio_templates(organization_id, last_used_at DESC NULLS LAST)
  WHERE last_used_at IS NOT NULL;

-- ============================================================
-- AUDIT LEDGER — extend action CHECK to cover usage + feedback
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'document_studio_template_audit'
      AND constraint_name = 'document_studio_template_audit_action_check'
  ) THEN
    ALTER TABLE document_studio_template_audit
      DROP CONSTRAINT document_studio_template_audit_action_check;
  END IF;
END$$;

-- The original migration created the CHECK as an inline anonymous
-- constraint (no name). Postgres autogenerates a name like
-- `document_studio_template_audit_action_check`; we can't rely on
-- that exact name across deployments, so the safe path is to drop
-- any matching constraint and re-add a named one.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'document_studio_template_audit'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%action%IN%'
  LOOP
    EXECUTE format('ALTER TABLE document_studio_template_audit DROP CONSTRAINT %I', c.conname);
  END LOOP;
END$$;

ALTER TABLE document_studio_template_audit
  ADD CONSTRAINT document_studio_template_audit_action_check
  CHECK (action IN (
    'template_drafted',
    'template_updated',
    'template_approved',
    'template_deprecated',
    'template_usage_recorded',
    'template_feedback_recorded'
  ));

-- ============================================================
-- COMMENT
-- ============================================================

COMMENT ON COLUMN document_studio_templates.usage_count IS
  'Slice E14: monotonic count of template applications (Mode 3 generations).';
COMMENT ON COLUMN document_studio_templates.last_used_at IS
  'Slice E14: ISO timestamp of last apply. Powers FE-E2 recently-used sort.';
COMMENT ON COLUMN document_studio_templates.feedback_quality_score IS
  'Slice E14: running average 1..5 rating (recordTemplateFeedback).';
COMMENT ON COLUMN document_studio_templates.feedback_sample_size IS
  'Slice E14: number of ratings folded into feedback_quality_score.';
COMMENT ON COLUMN document_studio_templates.persona_tags IS
  'Slice E14: free-form audience persona tags (cto, cfo, board, ...).';
COMMENT ON COLUMN document_studio_templates.region_tags IS
  'Slice E14: geography tags (EU, US, APAC, PL, DACH, ...).';
COMMENT ON COLUMN document_studio_templates.brand_tags IS
  'Slice E14: industry / brand tags (fintech, healthcare, retail, ...).';
COMMENT ON COLUMN document_studio_templates.dependency_tags IS
  'Slice E14: required source-pack inputs (requires_financial_data, ...).';
