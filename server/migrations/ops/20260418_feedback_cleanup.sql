-- Cleanup 2026-04-18: remove noise + already-resolved items from feedback_items.
--
-- Rationale: board cleanup requested by CTO. Audit trail for the resolved
-- items is preserved in:
--   - server/migrations/ops/20260418_feedback_backfill_chat_bugs.sql
--   - server/migrations/ops/20260418_feedback_weekly_triage.sql
--   - git commit log (fixes + this cleanup)
--
-- Scope (6 rows):
--   ARCHIVED triage-noise (test submissions) — 2 rows
--   RESOLVED historical record (backfilled)  — 4 rows

BEGIN;

-- Snapshot into a dated audit table so nothing is truly lost.
CREATE TABLE IF NOT EXISTS feedback_items_deleted_20260418 AS
  TABLE feedback_items WITH NO DATA;

INSERT INTO feedback_items_deleted_20260418
SELECT * FROM feedback_items
WHERE id IN (
  '95c99a86-b6af-407e-8049-cf2fdfcc3f21',  -- test (triage-noise)
  '1d6f441d-b648-4092-b7d8-a143e9931554',  -- Teat 2 (triage-noise)
  '176f5cae-206d-464d-8a23-f3c19c59980e',  -- DrDioniz auth (RESOLVED)
  '158e0d72-c980-4deb-812b-6126d219ffc1',  -- Signup auto-auth  (RESOLVED)
  'cc1a939c-e661-467c-bfcc-73a0188d50d3',  -- Demo reframe (RESOLVED)
  '2fbb6b19-5448-477d-a0c1-7befa25276ab'   -- Superadmin Users empty (RESOLVED)
);

DELETE FROM feedback_items
WHERE id IN (
  '95c99a86-b6af-407e-8049-cf2fdfcc3f21',
  '1d6f441d-b648-4092-b7d8-a143e9931554',
  '176f5cae-206d-464d-8a23-f3c19c59980e',
  '158e0d72-c980-4deb-812b-6126d219ffc1',
  'cc1a939c-e661-467c-bfcc-73a0188d50d3',
  '2fbb6b19-5448-477d-a0c1-7befa25276ab'
);

COMMIT;
