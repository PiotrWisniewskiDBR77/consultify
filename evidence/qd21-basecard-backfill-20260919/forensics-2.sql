-- QD21 KROK 0, dogrywka: schemat v8 (duplikaty tabel), populacja orgów, stan ateliertoys-demo.
-- Wyłącznie odczyt.
\echo '=== [13] czym jest v8.v8_output_artifacts (r=table, v=view, m=matview) ==='
SELECT n.nspname, c.relname, c.relkind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relname IN ('v8_output_artifacts','v8_artifact_origin_links')
 ORDER BY 1, 2;

\echo '=== [14] liczniki public vs v8 ==='
SELECT (SELECT count(*) FROM public.v8_output_artifacts)     AS public_artifacts,
       (SELECT count(*) FROM public.v8_artifact_origin_links) AS public_links;

\echo '=== [15] search_path sesji (runner i psql) ==='
SHOW search_path;

\echo '=== [16] populacja organizations: status / is_active / organization_type ==='
SELECT coalesce(status,'(NULL)') AS status, is_active, coalesce(organization_type,'(NULL)') AS org_type, count(*)
  FROM organizations GROUP BY 1,2,3 ORDER BY 4 DESC;

\echo '=== [17] co JUŻ ma ateliertoys-demo (te 2 artefakty) ==='
SELECT artifact_id, output_type, delivery_state, template_family_ref, created_by,
       created_at::text AS created_at, artifact_family, title_snapshot, canonical_home,
       visibility_scope, is_draft
  FROM public.v8_output_artifacts WHERE organization_id = 'ateliertoys-demo';

\echo '=== [18] czy w public.v8_output_artifacts istnieje juz jakis wiersz o ID z wzorca 20262271 dla ateliertoys-demo ==='
SELECT count(*) AS istniejace_template1_dla_atelier
  FROM public.v8_output_artifacts
 WHERE artifact_id LIKE 'template-1-%' AND organization_id = 'ateliertoys-demo';

\echo '=== [19] readback SCOPED (jak w opcji A): duplikaty wyłącznie wśród 3 kanonicznych źródeł ==='
SELECT count(*) AS grupy_z_duplikatem
  FROM (
    SELECT a.organization_id, a.template_family_ref
      FROM public.v8_output_artifacts a
      JOIN public.v8_artifact_origin_links l
        ON l.artifact_id = a.artifact_id AND l.organization_id = a.organization_id
     WHERE (l.origin_runtime, l.origin_record_id) IN (
             ('document_template','doc-template-system-en-client_final_report'),
             ('presentation_template','dbr77-deck-board'),
             ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'))
       AND a.template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
       AND a.is_draft = 0
     GROUP BY a.organization_id, a.template_family_ref
    HAVING count(*) > 1
  ) x;

\echo '=== [20] NIESCOPED readback 20262271:502-511 (ile org/rodzin ma >1 aktywną kartę bazową) ==='
SELECT count(*) AS grupy_z_duplikatem_niescoped
  FROM (
    SELECT organization_id, template_family_ref
      FROM public.v8_output_artifacts
     WHERE template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE') AND is_draft = 0
     GROUP BY organization_id, template_family_ref
    HAVING count(*) > 1
  ) y;
