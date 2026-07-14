CREATE TABLE IF NOT EXISTS tp_base_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  thumbnail_url TEXT,
  schema_snapshot JSONB NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_templates_category ON tp_base_templates(category);
CREATE INDEX IF NOT EXISTS idx_tp_templates_featured ON tp_base_templates(is_featured) WHERE is_featured = true;

-- FRESH-DB PARITY (2026-07-14): 20260508_block_a_template_lifecycle.sql sorts
-- BEFORE this file on a fresh replay, so its lifecycle additions are skipped
-- (guarded on table existence). Re-apply them here idempotently so the final
-- schema matches staging/prod. No-op wherever they already exist.
ALTER TABLE tp_base_templates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS governance_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tp_base_templates_status_check'
  ) THEN
    ALTER TABLE tp_base_templates
      ADD CONSTRAINT tp_base_templates_status_check
      CHECK (status IN ('draft', 'approved', 'deprecated'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tp_templates_status     ON tp_base_templates(status);
CREATE INDEX IF NOT EXISTS idx_tp_templates_owner_user ON tp_base_templates(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Promotion of legacy featured rows (no-op on a fresh, empty table; original
-- promotion ran in 20260508 on DBs that had the rows).
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
