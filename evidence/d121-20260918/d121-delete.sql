-- ============================================================================
-- D-121 (Wpis 178 [D] pt 1) — orphaned interview_evidence delete-rows runbook.
-- LIVE staging (railway). Mandate: DELETE-ROWS (NIE fabricate-text, NIE zero-out).
-- Org: Northwind Manufacturing Ltd. = 468b234c-66c4-54e1-b626-5e0fb3a92f6a
-- Session: 13c932b0-e750-410c-996b-66a98f8fb234 (the D-49-LIVE junk NW session).
--
-- Targets (KROK 0 measured on live, EXACTLY 2 rows, the ONLY question_id-NULL
-- orphans in the whole table):
--   interview_evidence 03e3f1d9  title='Answer – Q e563ed82'  evidence_role=answer_text
--   interview_evidence b140e82d  title='Answer – Q 233ae4ce'  evidence_role=answer_text
-- Both are answer_text MIRRORS of the 2 junk questions (233ae4ce + e563ed82,
-- answer_text='asdf asdf qwerty nie wiem 123') deleted in D-49-LIVE. The FK
-- interview_evidence.question_id -> interview_questions ON DELETE SET NULL left
-- them orphaned (question_id NULL). transcript_text/file_name/url ALL empty ->
-- zero evidentiary content == "śmieć" per Wpis 178 -> delete-rows.
--
-- FK pre-flight (Wpis 178 pt 2): 0 FKs point AT interview_evidence -> deleting
--   these rows cascades to NOTHING; "touched" == exactly these 2 rows.
-- Idempotency: WHERE anchors on the 2 ids AND question_id IS NULL AND role/title
--   -> 2nd pass matches 0 rows.
-- Safety: ONE transaction; in-txn assertions RAISE (roll back) if the 2 targets
--   are not gone OR collateral (NW evidence 19->17, session-13c932b0 evidence
--   5->3, interview_questions real 128, interview_sessions real 26) is off.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- delete the 2 orphaned answer_text mirrors (surgical: id + orphan + role + session)
DELETE FROM interview_evidence
 WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a'
   AND session_id = '13c932b0-e750-410c-996b-66a98f8fb234'
   AND question_id IS NULL
   AND evidence_role = 'answer_text'
   AND id IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b');

-- in-txn proof: targets gone + collateral intact, else ROLL BACK
DO $do$
DECLARE n_target int; n_ie_nw int; n_ie_sess int; n_iq int; n_is int;
BEGIN
  SELECT count(*) INTO n_target FROM interview_evidence
   WHERE id IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b');
  IF n_target <> 0 THEN
    RAISE EXCEPTION 'D121_NOT_PROVEN: % target rows remain', n_target;
  END IF;

  SELECT count(*) INTO n_ie_nw FROM interview_evidence
   WHERE organization_id = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
  IF n_ie_nw <> 17 THEN
    RAISE EXCEPTION 'D121_COLLATERAL_IE_NW: expected 17 NW evidence rows (19-2), got %', n_ie_nw;
  END IF;

  SELECT count(*) INTO n_ie_sess FROM interview_evidence
   WHERE session_id = '13c932b0-e750-410c-996b-66a98f8fb234';
  IF n_ie_sess <> 3 THEN
    RAISE EXCEPTION 'D121_COLLATERAL_IE_SESSION: expected 3 surviving session evidence rows (5-2), got %', n_ie_sess;
  END IF;

  SELECT count(*) INTO n_iq FROM interview_questions
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%');
  IF n_iq <> 128 THEN
    RAISE EXCEPTION 'D121_COLLATERAL_IQ: interview_questions real changed, expected 128, got %', n_iq;
  END IF;

  SELECT count(*) INTO n_is FROM interview_sessions
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%');
  IF n_is <> 26 THEN
    RAISE EXCEPTION 'D121_COLLATERAL_IS: interview_sessions real changed, expected 26, got %', n_is;
  END IF;

  RAISE NOTICE 'D121_PROVEN: 2 targets gone, collateral intact (ie_nw=%, ie_session=%, iq_real=%, is_real=%)',
    n_ie_nw, n_ie_sess, n_iq, n_is;
END
$do$;

COMMIT;
