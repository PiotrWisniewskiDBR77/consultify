-- B17 / D-144: one runtime entry point for the same three canonical base-card
-- rows repaired for existing organizations by 20262306. 20262306 is already
-- applied/queued as immutable DML, so this successor migration adds the
-- reusable function without rewriting that migration.

CREATE OR REPLACE FUNCTION public.seed_organization_base_artifacts(
  p_organization_id text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_link_count integer;
BEGIN
  WITH bases AS (
    SELECT 'DOC-BASE'::text family, 'document_template'::text runtime,
           'doc-template-system-en-client_final_report'::text source_id,
           'report'::text output_type,
           '[System] Client final report (EN)'::text title
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
     WHERE o.id = p_organization_id
       AND NOT EXISTS (
         SELECT 1
           FROM public.v8_artifact_origin_links l
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
         'runtime:seed_organization_base_artifacts', CURRENT_TIMESTAMP::text,
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
    SELECT 'SHEET-BASE', 'sheet_template',
           '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'
  ), missing AS (
    SELECT o.id AS organization_id, b.family, b.runtime, b.source_id
      FROM organizations o
     CROSS JOIN bases b
     WHERE o.id = p_organization_id
       AND NOT EXISTS (
         SELECT 1
           FROM public.v8_artifact_origin_links l
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
  SELECT 'template-1-link-' ||
           md5(organization_id || ':' || runtime || ':' || source_id),
         artifact_id, organization_id, runtime, source_id, 1,
         CURRENT_TIMESTAMP::text
    FROM picked
  ON CONFLICT DO NOTHING;

  SELECT count(l.link_id)::integer
    INTO canonical_link_count
    FROM public.v8_artifact_origin_links l
   WHERE l.organization_id = p_organization_id
     AND (l.origin_runtime, l.origin_record_id) IN (
       ('document_template', 'doc-template-system-en-client_final_report'),
       ('presentation_template', 'dbr77-deck-board'),
       ('sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
     );

  RETURN canonical_link_count;
END;
$$;
