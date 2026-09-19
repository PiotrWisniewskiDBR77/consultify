-- 20262306_basecard_backfill_missing_orgs.sql
-- QD21 (KANAL [D] Wpis 234, numer wg Wpisu 237): organizations created AFTER
-- 20262271 ran never received the three canonical base cards (DOC-BASE /
-- DECK-BASE / SHEET-BASE) because 20262271 snapshots every org present at its
-- own apply time. Measured on the 2026-09-19 staging dump: 13 orgs, exactly
-- one (`ateliertoys-demo`, created 2026-09-18 01:37) has 0 of the 3 canonical
-- origin links; the gap 36 vs 13*3=39 is exactly that org.
--
-- This migration inserts ONLY the missing (org, source) pairs: 3 library
-- snapshots + 3 origin links per lacking org, deterministic IDs identical to
-- the 20262271 formula, bare ON CONFLICT DO NOTHING (the links table has two
-- unique targets, so a targeted conflict clause could still throw), and a
-- scoped readback assertion: after UP every organization has exactly one
-- canonical link per base source. It never DELETEs and never re-runs 20262271.
--
-- Tables are qualified with `public.` on purpose: a second, empty
-- `v8.v8_output_artifacts` with the old column set also exists and
-- search_path is "$user", public.

WITH bases AS (
  SELECT 'DOC-BASE'::text family, 'document_template'::text runtime,
         'doc-template-system-en-client_final_report'::text source_id,
         'report'::text output_type, '[System] Client final report (EN)'::text title
  UNION ALL
  SELECT 'DECK-BASE', 'presentation_template', 'dbr77-deck-board',
         'presentation', 'Board deck'
  UNION ALL
  SELECT 'SHEET-BASE', 'sheet_template',
         '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1', 'sheet',
         'Supplier scorecard workbook'
), missing AS (
  SELECT o.id AS organization_id, b.family, b.runtime, b.source_id,
         b.output_type, b.title
    FROM organizations o
   CROSS JOIN bases b
   WHERE NOT EXISTS (
     SELECT 1 FROM public.v8_artifact_origin_links l
      WHERE l.organization_id = o.id
        AND l.origin_runtime = b.runtime
        AND l.origin_record_id = b.source_id
   )
), picked AS (
  SELECT m.*,
         COALESCE(
           prev.artifact_id,
           'template-1-' || lower(replace(m.family, '-', '')) || '-' ||
             md5(m.organization_id || ':' || m.source_id)
         ) AS artifact_id
    FROM missing m
    LEFT JOIN LATERAL (
      SELECT a.artifact_id
        FROM public.v8_output_artifacts a
       WHERE a.organization_id = m.organization_id
         AND a.artifact_family = 'template'
         AND a.template_family_ref = m.family
       ORDER BY a.created_at
       LIMIT 1
    ) prev ON TRUE
)
INSERT INTO public.v8_output_artifacts (
  artifact_id, organization_id, output_type, delivery_state,
  template_family_ref, created_by, created_at, last_transition_at,
  artifact_family, title_snapshot, canonical_home, visibility_scope,
  origin_summary_json, is_draft
)
SELECT artifact_id, organization_id, output_type, 'ready', family,
       'migration:20262306_basecard_backfill', CURRENT_TIMESTAMP::text,
       CURRENT_TIMESTAMP::text, 'template', title, 'outputs_library',
       'organization',
       jsonb_build_object(
         'template', jsonb_build_object(
           'family', family, 'status', 'approved', 'language', 'en',
           'system', true, 'readOnly', true, 'duplicateAllowed', true,
           'sourceRuntime', runtime, 'sourceId', source_id,
           'contractVersion', 'template-1-v1'
         )
       )::text,
       0
  FROM picked
ON CONFLICT DO NOTHING;

WITH bases AS (
  SELECT 'DOC-BASE'::text family, 'document_template'::text runtime,
         'doc-template-system-en-client_final_report'::text source_id
  UNION ALL
  SELECT 'DECK-BASE', 'presentation_template', 'dbr77-deck-board'
  UNION ALL
  SELECT 'SHEET-BASE', 'sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'
), missing AS (
  SELECT o.id AS organization_id, b.family, b.runtime, b.source_id
    FROM organizations o
   CROSS JOIN bases b
   WHERE NOT EXISTS (
     SELECT 1 FROM public.v8_artifact_origin_links l
      WHERE l.organization_id = o.id
        AND l.origin_runtime = b.runtime
        AND l.origin_record_id = b.source_id
   )
), picked AS (
  SELECT m.*,
         COALESCE(
           prev.artifact_id,
           'template-1-' || lower(replace(m.family, '-', '')) || '-' ||
             md5(m.organization_id || ':' || m.source_id)
         ) AS artifact_id
    FROM missing m
    LEFT JOIN LATERAL (
      SELECT a.artifact_id
        FROM public.v8_output_artifacts a
       WHERE a.organization_id = m.organization_id
         AND a.artifact_family = 'template'
         AND a.template_family_ref = m.family
       ORDER BY a.created_at
       LIMIT 1
    ) prev ON TRUE
)
INSERT INTO public.v8_artifact_origin_links (
  link_id, artifact_id, organization_id, origin_runtime,
  origin_record_id, is_primary_origin, created_at
)
SELECT 'template-1-link-' || md5(organization_id || ':' || runtime || ':' || source_id),
       artifact_id, organization_id, runtime, source_id, 1,
       CURRENT_TIMESTAMP::text
  FROM picked
ON CONFLICT DO NOTHING;

-- Scoped readback (Wpis 234): per organization exactly one canonical link per
-- base source. Counts LINKS, not is_draft=0 — org a3e05d4a-… keeps its
-- DECK-BASE card as a draft, so a draft-blind assertion would fail an org
-- that lacks nothing.
DO $$
DECLARE
  bad RECORD;
BEGIN
  FOR bad IN
    SELECT o.id AS org_id,
           count(l.link_id)::int AS canonical_links
      FROM organizations o
      LEFT JOIN public.v8_artifact_origin_links l
        ON l.organization_id = o.id
       AND (l.origin_runtime, l.origin_record_id) IN (
             ('document_template', 'doc-template-system-en-client_final_report'),
             ('presentation_template', 'dbr77-deck-board'),
             ('sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
           )
     GROUP BY o.id
    HAVING count(l.link_id) <> 3
  LOOP
    RAISE EXCEPTION
      '20262306 scoped readback failed: org % has % canonical base links, expected 3',
      bad.org_id, bad.canonical_links;
  END LOOP;
END $$;
