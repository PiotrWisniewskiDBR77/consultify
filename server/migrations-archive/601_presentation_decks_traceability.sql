-- Migration 601: V3-A01 — Add traceability columns to presentation_decks
-- Every output must have canonical source_type + source_id for governance/audit.

ALTER TABLE presentation_decks ADD COLUMN source_type TEXT DEFAULT 'manual';
ALTER TABLE presentation_decks ADD COLUMN source_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pd_source ON presentation_decks(source_type, source_id);
