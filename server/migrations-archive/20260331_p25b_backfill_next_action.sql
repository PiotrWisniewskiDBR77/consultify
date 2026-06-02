-- Migration: 20260331_p25b_backfill_next_action.sql
-- Purpose: Backfill next_action metadata for P25-B primer articles when rows already existed.
-- Notes:
-- - 20260330_p25b_kb_next_action_and_primers.sql used INSERT OR IGNORE, which does not repair stale rows.
-- - This migration is idempotent and safe to re-run.

UPDATE kb_articles
SET next_action = '{"route":"/discovery-tools"}'
WHERE slug = 'p25b-tools-primer'
  AND (next_action IS NULL OR TRIM(next_action) = '');

UPDATE kb_articles
SET next_action = '{"route":"/interview"}'
WHERE slug = 'p25b-interview-primer'
  AND (next_action IS NULL OR TRIM(next_action) = '');

UPDATE kb_articles
SET next_action = '{"route":"/presentations"}'
WHERE slug = 'p25b-outputs-primer'
  AND (next_action IS NULL OR TRIM(next_action) = '');

UPDATE kb_articles
SET next_action = '{"route":"/discovery-tools"}'
WHERE slug = 'p25b-en-only'
  AND (next_action IS NULL OR TRIM(next_action) = '');
