-- Add columns present in primary INSERT that are missing from older staging schema.
-- All nullable TEXT/REAL so backfill is not required.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS impact TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS effort TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS value_driver TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS confidence_level TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS value_timing TEXT;
