-- TLS-BVP-001 / TLS-CATALOG-001: pin every new SWOT Candidate handoff to the
-- exact immutable, approved Tool Output selected by the human. Additive only:
-- historical receipts remain readable but are not upgraded by inference.
ALTER TABLE swot_candidate_handoffs
  ADD COLUMN IF NOT EXISTS tool_output_id TEXT,
  ADD COLUMN IF NOT EXISTS tool_output_version INTEGER,
  ADD COLUMN IF NOT EXISTS tool_output_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS source_revision INTEGER;

CREATE INDEX IF NOT EXISTS idx_swot_candidate_handoffs_output
  ON swot_candidate_handoffs (organization_id, tool_output_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ck_swot_candidate_handoff_lineage_all_or_none'
       AND conrelid = 'swot_candidate_handoffs'::regclass
  ) THEN
    ALTER TABLE swot_candidate_handoffs
      ADD CONSTRAINT ck_swot_candidate_handoff_lineage_all_or_none CHECK (
        num_nonnulls(tool_output_id, tool_output_version, tool_output_content_hash, source_revision) = 0
        OR
        (num_nonnulls(tool_output_id, tool_output_version, tool_output_content_hash, source_revision) = 4
          AND tool_output_version >= 1
          -- tool_outputs.content_hash is the kernel's canonical 16-hex digest;
          -- the receipt pins that exact stored value, never a re-hash.
          AND tool_output_content_hash ~ '^[0-9a-f]{16}$' AND source_revision >= 1)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION reject_swot_candidate_handoff_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'swot_candidate_handoffs is append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_swot_candidate_handoffs_append_only
  ON swot_candidate_handoffs;
CREATE TRIGGER trg_swot_candidate_handoffs_append_only
BEFORE UPDATE OR DELETE ON swot_candidate_handoffs
FOR EACH ROW EXECUTE FUNCTION reject_swot_candidate_handoff_mutation();
