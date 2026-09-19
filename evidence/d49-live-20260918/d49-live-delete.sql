-- ============================================================================
-- D-49-LIVE / DEC-673 (Wpis 171 [D] P1) — NW junk delete-rows runbook.
-- LIVE staging (railway). Mandate: DELETE-ROWS (NIE fabricate-text, NIE zero-out).
-- Org: Northwind Manufacturing Ltd. = 468b234c-66c4-54e1-b626-5e0fb3a92f6a
-- Targets (KROK 0 measured on live, exactly 3 rows):
--   (a) interview_questions 233ae4ce + e563ed82, answer_text='asdf asdf qwerty nie wiem 123',
--       session 13c932b0  -> DELETE (2 rows)
--   (b) execution_report_snapshots 6099f51a 'Execution report — CTO smoke 17.09' DRAFT
--       -> DELETE (1 row, no FK children)
-- FK side effect (disclosed, NOT expanded per DEC-607): deleting (a) fires
--   interview_evidence ON DELETE SET NULL on 2 answer-mirror rows
--   (03e3f1d9, b140e82d) -> question_id becomes NULL; rows are NOT deleted, so the
--   total row-count difference stays EXACTLY 3.
-- Idempotency: every WHERE anchors on the junk VALUE / 'CTO smoke' title -> 2nd pass = 0.
-- Safety: ONE transaction; in-txn assertions RAISE (roll back) if the 3 targets are
--   not gone OR collateral (2 legit NW snapshots, 4 legit session answers) is lost.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- (a) delete the 2 junk interview answers
DELETE FROM interview_questions
 WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
   AND answer_text = 'asdf asdf qwerty nie wiem 123'
   AND id IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96');

-- (b) delete the CTO smoke duplicate snapshot (uuid columns)
DELETE FROM execution_report_snapshots
 WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'::uuid
   AND title ILIKE '%CTO smoke%'
   AND id = '6099f51a-57a8-40ed-b3d3-966bb1565dd7'::uuid;

-- in-txn proof: targets gone + collateral intact, else ROLL BACK
DO $do$
DECLARE n_iq int; n_ers int; n_snap int; n_ans int;
BEGIN
  SELECT count(*) INTO n_iq FROM interview_questions
   WHERE id IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96');
  SELECT count(*) INTO n_ers FROM execution_report_snapshots
   WHERE id = '6099f51a-57a8-40ed-b3d3-966bb1565dd7'::uuid;
  IF n_iq <> 0 OR n_ers <> 0 THEN
    RAISE EXCEPTION 'D49_NOT_PROVEN: targets remain iq=% ers=%', n_iq, n_ers;
  END IF;
  SELECT count(*) INTO n_snap FROM execution_report_snapshots
   WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'::uuid;
  IF n_snap <> 2 THEN
    RAISE EXCEPTION 'D49_COLLATERAL_SNAPSHOTS: expected 2 legit NW snapshots, got %', n_snap;
  END IF;
  SELECT count(*) INTO n_ans FROM interview_questions
   WHERE session_id = '13c932b0-e750-410c-996b-66a98f8fb234'
     AND answer_text IS DISTINCT FROM 'asdf asdf qwerty nie wiem 123';
  IF n_ans <> 4 THEN
    RAISE EXCEPTION 'D49_COLLATERAL_ANSWERS: expected 4 legit session answers, got %', n_ans;
  END IF;
  RAISE NOTICE 'D49_PROVEN: targets gone, collateral intact (snapshots=%, answers=%)', n_snap, n_ans;
END
$do$;

COMMIT;
