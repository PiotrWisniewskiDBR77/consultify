-- ============================================================================
-- D-121 (Wpis 178 [D]) — surgical checksum of the 13 real orgs across the tables
-- in scope, EXCLUDING the 2 touched rows. PRZED must equal PO: proves nothing
-- outside the 2 deleted rows changed.
-- Target: interview_evidence 03e3f1d9 + b140e82d (orphaned answer_text mirrors,
--   question_id NULL after D-49-LIVE FK SET NULL; empty transcript/file/url).
-- FK pre-flight: 0 FKs point AT interview_evidence -> deleting its rows cascades
--   to NOTHING; "touched" == exactly the 2 deleted rows (no SET NULL/CASCADE side effect).
-- Related tables interview_questions / interview_sessions are fingerprinted whole
--   (untouched) to prove the delete is self-contained.
-- All id/organization_id/session_id columns are text -> no casts needed.
-- ============================================================================
\pset tuples_only on

SELECT 'ORG_COUNT=' || count(*) FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%';

-- per-table real-org counts EXCLUDING the 2 touched rows (must be IDENTICAL PRZED/PO)
SELECT 'DETAIL interview_evidence real_excl_touched=' || count(*) FROM interview_evidence
 WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
   AND id NOT IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b');
SELECT 'DETAIL interview_questions real=' || count(*) FROM interview_questions
 WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%');
SELECT 'DETAIL interview_sessions real=' || count(*) FROM interview_sessions
 WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%');

-- TOTAL real-org rows across the 3 tables INCLUDING touched (PRZED - PO must be EXACTLY 2)
SELECT 'TOTAL_INCL_TOUCHED=' || (
   (SELECT count(*) FROM interview_evidence  WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'))
 + (SELECT count(*) FROM interview_questions WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'))
 + (SELECT count(*) FROM interview_sessions  WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')));

-- combined md5 fingerprint: ie EXCLUDING the 2 touched rows + iq/is whole (untouched)
SELECT 'CHECKSUM=' || md5(string_agg(sig, '|' ORDER BY sig)) FROM (
  SELECT 'ie:'||id||':'||md5(row_to_json(t)::text) AS sig FROM interview_evidence t
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
     AND id NOT IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b')
  UNION ALL
  SELECT 'iq:'||id||':'||md5(row_to_json(t)::text) FROM interview_questions t
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
  UNION ALL
  SELECT 'is:'||id||':'||md5(row_to_json(t)::text) FROM interview_sessions t
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
) x;
