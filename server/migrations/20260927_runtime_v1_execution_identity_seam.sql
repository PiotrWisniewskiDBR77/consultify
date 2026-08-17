-- INI-BVP-001: canonical runtime-v1 Initiative/Execution identity seam.
-- Legacy case_core links remain readable/writable; runtime-v1 is represented
-- directly and never materialized as a legacy shadow row.

ALTER TABLE execution_case_links
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'LEGACY_CASE_CORE',
  ADD COLUMN IF NOT EXISTS runtime_initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS runtime_execution_case_id TEXT,
  ADD COLUMN IF NOT EXISTS source_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_project_id TEXT;

ALTER TABLE execution_case_links ALTER COLUMN initiative_id DROP NOT NULL;
ALTER TABLE execution_case_links ALTER COLUMN case_id DROP NOT NULL;
ALTER TABLE execution_case_links ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE execution_case_links
  DROP CONSTRAINT IF EXISTS execution_case_links_source_identity_check;
ALTER TABLE execution_case_links
  ADD CONSTRAINT execution_case_links_source_identity_check CHECK (
    (source_kind = 'LEGACY_CASE_CORE'
      AND initiative_id IS NOT NULL AND case_id IS NOT NULL AND project_id IS NOT NULL
      AND runtime_initiative_id IS NULL AND runtime_execution_case_id IS NULL)
    OR
    (source_kind = 'RUNTIME_V1'
      AND initiative_id IS NULL AND case_id IS NULL AND project_id IS NULL
      AND runtime_initiative_id IS NOT NULL AND runtime_execution_case_id IS NOT NULL
      AND source_project_id IS NOT NULL AND source_version > 0)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_case_links_runtime_initiative
  ON execution_case_links(organization_id, runtime_initiative_id)
  WHERE source_kind = 'RUNTIME_V1';
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_case_links_runtime_case
  ON execution_case_links(organization_id, runtime_execution_case_id)
  WHERE source_kind = 'RUNTIME_V1';
