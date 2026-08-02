-- Durable F2 candidate acceptance receipt.
--
-- Accept retries/double-clicks must resolve to the same initiative instead of
-- creating another DRAFT. duplicate_of_initiative_id records the explicit merge
-- decision when semantic de-duplication selected an already-existing initiative.

ALTER TABLE initiative_candidates
  ADD COLUMN IF NOT EXISTS initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_of_initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_initiative_candidates_initiative
  ON initiative_candidates(organization_id, initiative_id)
  WHERE initiative_id IS NOT NULL;
