-- QD21 (Wpis 234, DEC-691, opcja B z QB0e) — KROK 0: pomiar PRZED napisaniem migracji.
-- Wyłącznie SELECT / katalogi systemowe. Zero zapisów, zero DELETE, staging nietknięty
-- (kopia dumpu w kontenerze stanowiska D).
-- Źródło: evidence/qb0e-basecard-readback-20260919/RUNBOOK.md (opcja B) + 20262271:312-410.
-- REGUŁA 10 (Wpis 206): brak haseł i URL-i z sekretem; uruchamiane przez `docker exec`.

\echo '=== [1] org_count i stan 3 kanonicznych kart bazowych per org ==='
SELECT count(*) AS org_count FROM organizations;

WITH bases(runtime, source_id) AS (
  VALUES ('document_template','doc-template-system-en-client_final_report'),
         ('presentation_template','dbr77-deck-board'),
         ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
)
SELECT o.id AS org_id, left(o.name, 34) AS org_name, o.created_at::text AS org_created,
       count(l.link_id) AS canonical_links,
       count(a.artifact_id) AS canonical_snapshots,
       string_agg(DISTINCT a.template_family_ref, ',' ORDER BY a.template_family_ref) AS families
  FROM organizations o
  CROSS JOIN bases b
  LEFT JOIN v8_artifact_origin_links l
    ON l.organization_id = o.id AND l.origin_runtime = b.runtime AND l.origin_record_id = b.source_id
  LEFT JOIN v8_output_artifacts a
    ON a.artifact_id = l.artifact_id AND a.organization_id = l.organization_id
   AND a.template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
   AND a.artifact_family = 'template'
 GROUP BY o.id, o.name, o.created_at
 ORDER BY canonical_links, o.name;

\echo '=== [2] orgi, którym brakuje KTÓREJKOLWIEK z 3 kanonicznych kart (zbiór do backfillu) ==='
WITH bases(family, runtime, source_id) AS (
  VALUES ('DOC-BASE','document_template','doc-template-system-en-client_final_report'),
         ('DECK-BASE','presentation_template','dbr77-deck-board'),
         ('SHEET-BASE','sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
)
SELECT o.id AS org_id, left(o.name,34) AS org_name, b.family, b.runtime, b.source_id,
       (SELECT count(*) FROM v8_artifact_origin_links l
         WHERE l.organization_id=o.id AND l.origin_runtime=b.runtime AND l.origin_record_id=b.source_id) AS links_teraz
  FROM organizations o CROSS JOIN bases b
 WHERE NOT EXISTS (
         SELECT 1 FROM v8_artifact_origin_links l
          WHERE l.organization_id=o.id AND l.origin_runtime=b.runtime AND l.origin_record_id=b.source_id)
 ORDER BY o.name, b.family;

\echo '=== [3] globalne liczniki readbacku 20262271: snapshot_count / link_count vs org_count*3 ==='
SELECT (SELECT count(*) FROM organizations) AS org_count,
       (SELECT count(*) FROM organizations) * 3 AS oczekiwane,
       (SELECT count(*)
          FROM v8_artifact_origin_links l
          JOIN v8_output_artifacts a ON a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id
         WHERE (l.origin_runtime,l.origin_record_id) IN (
                 ('document_template','doc-template-system-en-client_final_report'),
                 ('presentation_template','dbr77-deck-board'),
                 ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'))
           AND a.template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
           AND a.artifact_family='template') AS snapshot_count,
       (SELECT count(*) FROM v8_artifact_origin_links
         WHERE (origin_runtime,origin_record_id) IN (
                 ('document_template','doc-template-system-en-client_final_report'),
                 ('presentation_template','dbr77-deck-board'),
                 ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'))) AS link_count;

\echo '=== [4] org bez kart (ateliertoys-demo): czy ma JAKIEKOLWIEK artefakty/linki? ==='
SELECT o.id, o.name, o.created_at::text,
       (SELECT count(*) FROM v8_output_artifacts a WHERE a.organization_id=o.id) AS artefakty_org,
       (SELECT count(*) FROM v8_artifact_origin_links l WHERE l.organization_id=o.id) AS linki_org,
       (SELECT count(*) FROM v8_output_artifacts a WHERE a.organization_id=o.id AND a.artifact_family='template') AS szablony_org
  FROM organizations o
 WHERE o.id IN (SELECT org FROM (
   SELECT o2.id AS org FROM organizations o2
    WHERE NOT EXISTS (SELECT 1 FROM v8_artifact_origin_links l
                       WHERE l.organization_id=o2.id
                         AND (l.origin_runtime,l.origin_record_id) IN (
                           ('document_template','doc-template-system-en-client_final_report'),
                           ('presentation_template','dbr77-deck-board'),
                           ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')))
 ) x);

\echo '=== [5] kolumny organizations (czy jest status/deleted do wykluczeń) ==='
SELECT column_name, data_type, is_nullable, coalesce(column_default,'-') AS default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='organizations'
 ORDER BY ordinal_position;

\echo '=== [6] kolumny v8_output_artifacts + v8_artifact_origin_links (typy, NULL-e, domyślne) ==='
SELECT table_name, column_name, data_type, is_nullable, coalesce(column_default,'-') AS default
  FROM information_schema.columns
 WHERE table_schema='public'
   AND table_name IN ('v8_output_artifacts','v8_artifact_origin_links')
 ORDER BY table_name, ordinal_position;

\echo '=== [7] cele ON CONFLICT: indeksy unikatowe i ograniczenia obu tabel ==='
SELECT tablename, indexname, indexdef FROM pg_indexes
 WHERE tablename IN ('v8_output_artifacts','v8_artifact_origin_links')
 ORDER BY tablename, indexname;
SELECT conrelid::regclass AS tabela, conname, contype, pg_get_constraintdef(oid) AS definicja
  FROM pg_constraint
 WHERE conrelid::regclass::text IN ('v8_output_artifacts','v8_artifact_origin_links')
 ORDER BY 1,2;

\echo '=== [8] czy deterministyczne artifact_id/link_id dla brakujących orgów kolidują z istniejącymi? ==='
WITH bases(family, runtime, source_id) AS (
  VALUES ('DOC-BASE','document_template','doc-template-system-en-client_final_report'),
         ('DECK-BASE','presentation_template','dbr77-deck-board'),
         ('SHEET-BASE','sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
)
SELECT o.id AS org_id, b.family,
       'template-1-' || lower(replace(b.family,'-','')) || '-' || md5(o.id || ':' || b.source_id) AS nowe_artifact_id,
       (SELECT count(*) FROM v8_output_artifacts a
         WHERE a.artifact_id = 'template-1-' || lower(replace(b.family,'-','')) || '-' || md5(o.id || ':' || b.source_id)) AS kolizja_artifact,
       'template-1-link-' || md5(o.id || ':' || b.runtime || ':' || b.source_id) AS nowe_link_id,
       (SELECT count(*) FROM v8_artifact_origin_links l
         WHERE l.link_id = 'template-1-link-' || md5(o.id || ':' || b.runtime || ':' || b.source_id)) AS kolizja_link
  FROM organizations o CROSS JOIN bases b
 WHERE NOT EXISTS (SELECT 1 FROM v8_artifact_origin_links l
                    WHERE l.organization_id=o.id AND l.origin_runtime=b.runtime AND l.origin_record_id=b.source_id)
 ORDER BY o.id, b.family;

\echo '=== [9] created_by na istniejących kanonicznych kartach (znacznik dla .down.sql) ==='
SELECT a.created_by, count(*) AS ile
  FROM v8_output_artifacts a
  JOIN v8_artifact_origin_links l ON l.artifact_id=a.artifact_id AND l.organization_id=a.organization_id
 WHERE (l.origin_runtime,l.origin_record_id) IN (
         ('document_template','doc-template-system-en-client_final_report'),
         ('presentation_template','dbr77-deck-board'),
         ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'))
 GROUP BY a.created_by ORDER BY 2 DESC;

\echo '=== [10] ile AKTYWNYCH kart DOC-BASE/DECK-BASE/SHEET-BASE ma każda org (musi się NIE zmienić) ==='
SELECT left(o.name,34) AS org_name,
       count(*) FILTER (WHERE a.template_family_ref='DOC-BASE'  AND a.is_draft=0) AS doc_base_aktywne,
       count(*) FILTER (WHERE a.template_family_ref='DECK-BASE' AND a.is_draft=0) AS deck_base_aktywne,
       count(*) FILTER (WHERE a.template_family_ref='SHEET-BASE' AND a.is_draft=0) AS sheet_base_aktywne,
       count(*) AS wszystkie_base
  FROM organizations o
  LEFT JOIN v8_output_artifacts a
    ON a.organization_id=o.id AND a.template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
 GROUP BY o.name ORDER BY wszystkie_base DESC, o.name;

\echo '=== [11] czy 3 ŹRÓDŁA kanoniczne istnieją (kontrakt 20262271:434-476) ==='
SELECT
 (SELECT count(*) FROM document_studio_templates
   WHERE template_id='doc-template-system-en-client_final_report' AND organization_id='__system__'
     AND is_system AND language='en' AND status='approved' AND provenance_status='approved') AS doc_source,
 (SELECT count(*) FROM presentation_templates
   WHERE id='dbr77-deck-board' AND organization_id IS NULL AND is_system AND is_active
     AND language_default='en' AND lifecycle_state='approved' AND provenance_status='approved'
     AND template_family='DECK-BASE') AS deck_source,
 (SELECT count(*) FROM tp_base_templates
   WHERE id='2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid AND organization_id='__system__'
     AND visibility='system' AND language='en' AND status='approved'
     AND provenance_status='approved') AS sheet_source;

\echo '=== [12] kształt wiersza kanonicznej karty (wzór dla INSERT) ==='
SELECT a.artifact_id, a.organization_id, a.output_type, a.delivery_state, a.template_family_ref,
       a.created_by, a.created_at::text, a.last_transition_at::text, a.artifact_family,
       a.title_snapshot, a.canonical_home, a.visibility_scope, left(a.origin_summary_json,180) AS origin_summary,
       a.is_draft
  FROM v8_output_artifacts a
  JOIN v8_artifact_origin_links l ON l.artifact_id=a.artifact_id AND l.organization_id=a.organization_id
 WHERE (l.origin_runtime,l.origin_record_id) IN (
         ('document_template','doc-template-system-en-client_final_report'),
         ('presentation_template','dbr77-deck-board'),
         ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'))
 ORDER BY a.template_family_ref
 LIMIT 3;
