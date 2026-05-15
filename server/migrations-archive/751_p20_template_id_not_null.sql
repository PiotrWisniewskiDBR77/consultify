-- P20 Contract Compliance: template_id must be mandatory (FINAL_IMPLEMENTATION_PLAN §2.3)
-- Backfill NULL template_id rows with 'default', then enforce NOT NULL.

UPDATE presentation_decks SET template_id = 'default' WHERE template_id IS NULL;

-- Set a default and enforce NOT NULL via ALTER COLUMN (PostgreSQL native).
ALTER TABLE presentation_decks ALTER COLUMN template_id SET DEFAULT 'default';
ALTER TABLE presentation_decks ALTER COLUMN template_id SET NOT NULL;
