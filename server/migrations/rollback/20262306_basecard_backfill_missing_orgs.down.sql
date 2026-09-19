-- rollback/20262306_basecard_backfill_missing_orgs.down.sql
-- QD21: removes ONLY the rows this migration wrote. Artifacts carry the
-- marker `migration:20262306_basecard_backfill` in created_by; links have no
-- such column, so they are removed through the artifact marker and never by
-- family or by the deterministic id alone (20262271 uses the same id formula
-- for orgs it snapshotted — deleting by id would erase its rows).
-- Links that point at a pre-existing unlinked base artifact (created_by <>
-- marker) survive by design: they were not created here, and NIGDY DELETE.

DELETE FROM public.v8_artifact_origin_links l
 WHERE (l.origin_runtime, l.origin_record_id) IN (
         ('document_template', 'doc-template-system-en-client_final_report'),
         ('presentation_template', 'dbr77-deck-board'),
         ('sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
       )
   AND l.artifact_id IN (
         SELECT a.artifact_id
           FROM public.v8_output_artifacts a
          WHERE a.created_by = 'migration:20262306_basecard_backfill'
       );

DELETE FROM public.v8_output_artifacts
 WHERE created_by = 'migration:20262306_basecard_backfill';
