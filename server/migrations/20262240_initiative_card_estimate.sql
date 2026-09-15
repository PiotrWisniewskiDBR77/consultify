-- A-1 / DEC-489: extend the canonical card version with its human-reviewable estimate.
-- Additive and nullable so existing card publications remain valid.
BEGIN;

ALTER TABLE ie_initiative_card_versions
  ADD COLUMN IF NOT EXISTS estimate_text TEXT,
  ADD COLUMN IF NOT EXISTS estimate_basis TEXT,
  ADD COLUMN IF NOT EXISTS estimated_by TEXT,
  ADD COLUMN IF NOT EXISTS estimated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ie_card_estimate_complete_tuple'
  ) THEN
    ALTER TABLE ie_initiative_card_versions
      ADD CONSTRAINT ie_card_estimate_complete_tuple CHECK (
        (estimate_text IS NULL AND estimate_basis IS NULL AND estimated_by IS NULL AND estimated_at IS NULL)
        OR
        (NULLIF(BTRIM(estimate_text), '') IS NOT NULL
          AND NULLIF(BTRIM(estimate_basis), '') IS NOT NULL
          AND NULLIF(BTRIM(estimated_by), '') IS NOT NULL
          AND estimated_at IS NOT NULL)
      );
  END IF;
END $$;

COMMIT;
