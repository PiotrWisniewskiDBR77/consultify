-- Migration 785: Add organization_id to tp_base_templates for org-scoped user templates
-- Idempotent (IF NOT EXISTS).

ALTER TABLE tp_base_templates ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tp_base_templates_org
  ON tp_base_templates(organization_id)
  WHERE organization_id IS NOT NULL;
