-- Day 175: durable Task card section "Risk & Alternatives".
-- Additive and idempotent; JSONB preserves the existing structured item shapes.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risks JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS alternatives JSONB;
