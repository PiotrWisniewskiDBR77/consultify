-- Forward repair B (release migration gate repair, 2026-08-13)
--
-- WHY: 700_table_platform_foundation.sql was applied to demo on 2026-03-15 from a version
-- predating its "Block C §1" addition. Verified read-only 2026-08-13: tp_schema_proposals lacks
-- the `level` column, its CHECK constraint and its partial index.
--
-- Forward-only; 700 itself is untouched. Constraint values mirror 700 exactly.

ALTER TABLE IF EXISTS tp_schema_proposals
  ADD COLUMN IF NOT EXISTS level TEXT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'tp_schema_proposals')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tp_schema_proposals_level_check')
  THEN
    ALTER TABLE tp_schema_proposals
      ADD CONSTRAINT tp_schema_proposals_level_check
      CHECK (level IS NULL OR level IN (
        'cell','record','column','structure',
        'view','relational','methodological','source'
      ));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tp_schema_proposals_level
  ON tp_schema_proposals(level)
  WHERE level IS NOT NULL;
