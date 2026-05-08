-- Migration 769: Consultify Document Studio — Template Registry Persistence
--
-- Epic E1, Slice 1.1: replaces the in-process `Map` registry in
-- `documentTemplateService.ts` with a durable Postgres backing store.
--
-- The service keeps an in-process cache (preserves the existing synchronous
-- public API and the 97-test green baseline). Reads hydrate the cache from
-- this table on first access per organization. Writes update the cache
-- synchronously and persist asynchronously (best-effort) so a process kill
-- between cache write and DB flush is the only failure mode — and even
-- then the user re-approves the template in the next session.
--
-- Schema-tolerant: missing-table errors fall back to the legacy in-process
-- Map (see `documentTemplateRegistryDao.ts` `safeMode`). The migration is
-- additive and idempotent.

-- ============================================================
-- TEMPLATE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS document_studio_templates (
  template_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  document_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  audience JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT NOT NULL DEFAULT 'pl',
  language_style TEXT NOT NULL DEFAULT 'consulting',
  communication_register TEXT NOT NULL DEFAULT 'professional',
  density TEXT NOT NULL DEFAULT 'standard',
  confidentiality TEXT NOT NULL DEFAULT 'internal',
  required_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  section_blueprint JSONB NOT NULL DEFAULT '[]'::jsonb,
  formatting_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  export_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  version TEXT NOT NULL DEFAULT '0.1',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  deprecated_by TEXT,
  deprecated_at TIMESTAMPTZ,
  notes TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE
);

-- Idempotent CHECK constraint on status — guarded so re-runs succeed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'document_studio_templates'
      AND constraint_name = 'document_studio_templates_status_check'
  ) THEN
    ALTER TABLE document_studio_templates
      ADD CONSTRAINT document_studio_templates_status_check
      CHECK (status IN ('draft', 'approved', 'deprecated'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_document_studio_templates_org_status
  ON document_studio_templates(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_document_studio_templates_org_doctype
  ON document_studio_templates(organization_id, document_type);

CREATE INDEX IF NOT EXISTS idx_document_studio_templates_system
  ON document_studio_templates(is_system)
  WHERE is_system = TRUE;

-- ============================================================
-- AUDIT LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS document_studio_template_audit (
  audit_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'template_drafted',
    'template_updated',
    'template_approved',
    'template_deprecated'
  )),
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_doc_studio_template_audit_tpl
  ON document_studio_template_audit(template_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_studio_template_audit_org
  ON document_studio_template_audit(organization_id, occurred_at DESC);

-- ============================================================
-- COMMENT
-- ============================================================

COMMENT ON TABLE document_studio_templates IS
  'Consultify Document Studio template registry. Owned by '
  'documentTemplateService.ts via documentTemplateRegistryDao.ts. '
  'is_system=TRUE rows are seeded by 770_document_studio_seed_templates.sql '
  'and serve every organization via the SYSTEM_ORG_ID convention.';

COMMENT ON TABLE document_studio_template_audit IS
  'Audit trail for Consultify Document Studio templates. Mirrors the '
  'in-process audit store keyed by templateId+organizationId.';
