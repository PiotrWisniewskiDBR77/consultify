-- Ensure initiative_dependencies.source_id exists and is non-null.
-- Some environments enforce NOT NULL without a default, which breaks inserts.

CREATE TABLE IF NOT EXISTS initiative_dependencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    from_initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    to_initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'FINISH_TO_START',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_org
ON initiative_dependencies(organization_id);
CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_project
ON initiative_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_from
ON initiative_dependencies(from_initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_to
ON initiative_dependencies(to_initiative_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'initiative_dependencies'
      AND column_name = 'source_id'
  ) THEN
    ALTER TABLE initiative_dependencies
      ADD COLUMN source_id TEXT NOT NULL DEFAULT 'manual';
  ELSE
    -- Backfill + enforce sane default for future inserts.
    UPDATE initiative_dependencies SET source_id = 'manual' WHERE source_id IS NULL;
    ALTER TABLE initiative_dependencies ALTER COLUMN source_id SET DEFAULT 'manual';
    ALTER TABLE initiative_dependencies ALTER COLUMN source_id SET NOT NULL;
  END IF;
END $$;

