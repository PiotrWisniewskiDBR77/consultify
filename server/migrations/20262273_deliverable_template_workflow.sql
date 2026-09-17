-- TPL-1b / DEC-558: governed "New template" authoring workflow.
-- Additive, tenant-scoped and format-neutral. The canonical template bodies
-- remain in their existing registries; this table owns the cross-format
-- authoring state, live-data test receipt and default assignment.

CREATE TABLE IF NOT EXISTS deliverable_template_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('doc', 'deck', 'table')),
  template_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'deprecated')),
  version TEXT NOT NULL DEFAULT '0.1',
  base_kind TEXT NOT NULL CHECK (base_kind IN ('archetype', 'system', 'own')),
  base_template_id TEXT,
  parent_workflow_id UUID REFERENCES deliverable_template_workflows(id),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'pl')),
  document_type TEXT NOT NULL DEFAULT 'custom',
  audience TEXT,
  confidentiality TEXT NOT NULL DEFAULT 'internal',
  source_bindings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_test_run_id UUID,
  last_test_passed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, template_type, template_id),
  CHECK ((base_kind = 'archetype' AND base_template_id IS NULL)
      OR (base_kind IN ('system', 'own') AND base_template_id IS NOT NULL)),
  CHECK (approved_by IS NULL OR approved_by <> author_user_id)
);

CREATE INDEX IF NOT EXISTS idx_deliverable_template_workflows_org_status
  ON deliverable_template_workflows (organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliverable_template_workflows_parent
  ON deliverable_template_workflows (parent_workflow_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deliverable_template_workflow_default
  ON deliverable_template_workflows (organization_id, document_type, template_type)
  WHERE is_default = TRUE AND status = 'approved';

CREATE TABLE IF NOT EXISTS deliverable_template_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES deliverable_template_workflows(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version TEXT NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('initiative', 'kpi', 'decision', 'artifact')),
  object_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  checks JSONB NOT NULL,
  export_format TEXT NOT NULL CHECK (export_format IN ('docx', 'pptx', 'xlsx')),
  export_byte_size INTEGER NOT NULL DEFAULT 0,
  run_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_template_test_runs_workflow
  ON deliverable_template_test_runs (workflow_id, created_at DESC);

COMMENT ON TABLE deliverable_template_workflows IS
  'TPL-1b cross-format draft -> live test -> submit -> independent approval workflow.';
COMMENT ON TABLE deliverable_template_test_runs IS
  'Immutable live organization/object test receipts gating template submission.';
