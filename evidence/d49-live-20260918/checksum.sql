-- D-49-LIVE (QD11 follow-up, DEC-673) — surgical checksum of the 13 real orgs
-- across the THREE tables touched by the delete, EXCLUDING the 5 touched rows
-- (3 to delete + 2 interview_evidence rows FK-nulled). PRZED must equal PO:
-- proves nothing outside the touched rows changed.
-- NOTE: execution_report_snapshots.id/.organization_id are uuid; the other two
-- tables and organizations.id are text -> ::text casts on the ers predicates.
-- Touched ids:
--   interview_questions  233ae4ce-7069-4578-899c-f20fc0fcbb9d, e563ed82-c572-4829-8206-158f3d2f5a96  (DELETE)
--   execution_report_snapshots 6099f51a-57a8-40ed-b3d3-966bb1565dd7                                    (DELETE)
--   interview_evidence   03e3f1d9-e286-4a76-b547-599cdec53d7a, b140e82d-a38e-4a3a-af01-39a8e3a16c6b   (SET NULL)
\pset tuples_only on

SELECT 'ORG_COUNT=' || count(*) FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%';

-- per-table real-org counts EXCLUDING touched rows (these must be IDENTICAL PRZED/PO)
SELECT 'DETAIL interview_questions real_excl_touched=' || count(*) FROM interview_questions
 WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
   AND id NOT IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96');
SELECT 'DETAIL execution_report_snapshots real_excl_touched=' || count(*) FROM execution_report_snapshots
 WHERE organization_id::text IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
   AND id::text NOT IN ('6099f51a-57a8-40ed-b3d3-966bb1565dd7');
SELECT 'DETAIL interview_evidence real_excl_touched=' || count(*) FROM interview_evidence
 WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
   AND id NOT IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b');

-- TOTAL real-org rows across the 3 tables INCLUDING touched (PRZED - PO must be EXACTLY 3)
SELECT 'TOTAL_INCL_TOUCHED=' || (
   (SELECT count(*) FROM interview_questions WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'))
 + (SELECT count(*) FROM execution_report_snapshots WHERE organization_id::text IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'))
 + (SELECT count(*) FROM interview_evidence WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')));

-- combined md5 fingerprint of all real-org rows in the 3 tables, EXCLUDING the 5 touched rows
SELECT 'CHECKSUM=' || md5(string_agg(sig, '|' ORDER BY sig)) FROM (
  SELECT 'iq:'||id||':'||md5(row_to_json(t)::text) AS sig FROM interview_questions t
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
     AND id NOT IN ('233ae4ce-7069-4578-899c-f20fc0fcbb9d','e563ed82-c572-4829-8206-158f3d2f5a96')
  UNION ALL
  SELECT 'ers:'||id::text||':'||md5(row_to_json(t)::text) FROM execution_report_snapshots t
   WHERE organization_id::text IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
     AND id::text NOT IN ('6099f51a-57a8-40ed-b3d3-966bb1565dd7')
  UNION ALL
  SELECT 'ie:'||id||':'||md5(row_to_json(t)::text) FROM interview_evidence t
   WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')
     AND id NOT IN ('03e3f1d9-e286-4a76-b547-599cdec53d7a','b140e82d-a38e-4a3a-af01-39a8e3a16c6b')
) x;
