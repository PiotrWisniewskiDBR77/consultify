-- Forward-only compatibility prerequisite for the curated workbook promotion.
-- Some upgraded databases record the historical baseline that introduced this
-- column while the physical tp_base_templates column is absent.

ALTER TABLE tp_base_templates
  ADD COLUMN IF NOT EXISTS visibility TEXT;

CREATE INDEX IF NOT EXISTS idx_tp_base_templates_visibility
  ON tp_base_templates(visibility);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tp_base_templates_visibility_check'
      AND conrelid = 'tp_base_templates'::regclass
  ) THEN
    ALTER TABLE tp_base_templates
      ADD CONSTRAINT tp_base_templates_visibility_check
      CHECK (visibility IS NULL OR visibility IN ('system', 'organization', 'private'))
      NOT VALID;
  END IF;
END $$;
