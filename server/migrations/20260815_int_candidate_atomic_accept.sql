-- CLEAN-002-INT-005/006: durable candidate promotion identity.
-- Apply after 20260802_int008_candidate_handoff.sql.
ALTER TABLE initiative_candidates
  ADD COLUMN IF NOT EXISTS initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS source_candidate_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_initiatives_source_candidate_id
  ON initiatives (source_candidate_id)
  WHERE source_candidate_id IS NOT NULL;
