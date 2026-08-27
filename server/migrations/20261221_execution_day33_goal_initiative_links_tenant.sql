ALTER TABLE goal_initiative_links
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS contribution_class TEXT,
  ADD COLUMN IF NOT EXISTS contribution_policy_id TEXT,
  ADD COLUMN IF NOT EXISTS contribution_policy_row_version INTEGER;

UPDATE goal_initiative_links gil
   SET organization_id = i.organization_id
  FROM initiatives i
 WHERE i.id = gil.initiative_id
   AND gil.organization_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'goal_initiative_links_contribution_class_check'
       AND conrelid = 'goal_initiative_links'::regclass
  ) THEN
    ALTER TABLE goal_initiative_links
      ADD CONSTRAINT goal_initiative_links_contribution_class_check
      CHECK (
        contribution_class IS NULL OR contribution_class IN (
          'CRITICAL',
          'IMPORTANT',
          'SUPPORTING'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goal_initiative_links_org_goal
  ON goal_initiative_links (organization_id, goal_id);
