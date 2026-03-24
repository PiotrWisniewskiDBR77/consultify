-- WS-D §6.3: Track refinement count per proposal
ALTER TABLE tp_schema_proposals ADD COLUMN IF NOT EXISTS refinement_count INTEGER NOT NULL DEFAULT 0;
