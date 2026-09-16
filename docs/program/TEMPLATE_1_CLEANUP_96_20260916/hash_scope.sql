WITH x AS (SELECT row_to_json(t)::text AS j FROM (SELECT * FROM document_studio_templates ORDER BY template_id) t)
SELECT 'document_studio_templates', md5(coalesce(string_agg(j,E'\n'),'') ) FROM x;
WITH x AS (SELECT row_to_json(t)::text AS j FROM (SELECT * FROM report_builder_templates ORDER BY id) t)
SELECT 'report_builder_templates', md5(coalesce(string_agg(j,E'\n'),'') ) FROM x;
WITH x AS (SELECT row_to_json(t)::text AS j FROM (SELECT * FROM presentation_templates ORDER BY id) t)
SELECT 'presentation_templates', md5(coalesce(string_agg(j,E'\n'),'') ) FROM x;
WITH x AS (SELECT row_to_json(t)::text AS j FROM (SELECT * FROM tp_base_templates ORDER BY id) t)
SELECT 'tp_base_templates', md5(coalesce(string_agg(j,E'\n'),'') ) FROM x;
WITH x AS (SELECT row_to_json(t)::text AS j FROM (SELECT * FROM v8_output_artifacts ORDER BY artifact_id,organization_id) t)
SELECT 'v8_output_artifacts', md5(coalesce(string_agg(j,E'\n'),'') ) FROM x;
WITH x AS (SELECT row_to_json(t)::text AS j FROM (SELECT * FROM v8_artifact_origin_links ORDER BY link_id) t)
SELECT 'v8_artifact_origin_links', md5(coalesce(string_agg(j,E'\n'),'') ) FROM x;
