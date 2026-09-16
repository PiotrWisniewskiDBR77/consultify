-- TEMPLATE-1b / W108 + W118: fail-closed cleanup of the measured 96-card
-- template inventory. The three base families are supplied by 20262271.
--
-- No source or origin link is invented. All 96 inventory items must resolve
-- before the first persistent write. Items #93-#96 are resolved from their
-- artifact IDs and must have exactly one origin link of the expected runtime.

BEGIN;

CREATE TEMP TABLE tmp_template96 (
  nr INTEGER PRIMARY KEY,
  decision TEXT NOT NULL CHECK (decision IN ('KEEP','REBUILD','DEPRECATE')),
  family TEXT NOT NULL CHECK (family IN ('DOC-BASE','DECK-BASE','SHEET-BASE')),
  runtime TEXT NOT NULL,
  source_id TEXT,
  artifact_id TEXT
) ON COMMIT DROP;

-- Source-backed inventory #1-#92.
INSERT INTO tmp_template96 (nr, decision, family, runtime, source_id)
SELECT nr, decision, family, runtime, source_id
FROM (VALUES
  (1,'REBUILD','DOC-BASE','document_template','doc-template-1789439070343-ovxij8xn'),
  (2,'REBUILD','DOC-BASE','document_template','doc-template-1789439070624-rj84kztq'),
  (3,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-ai_audit_report'),
  (4,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-ai_audit_report'),
  (5,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-benefits_tracking_report'),
  (6,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-benefits_tracking_report'),
  (7,'REBUILD','DOC-BASE','document_template','doc-template-system-en-board_report'),
  (8,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-board_report'),
  (9,'REBUILD','DOC-BASE','document_template','doc-template-system-en-business_case'),
  (10,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-business_case'),
  (11,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-change_management_plan'),
  (12,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-change_management_plan'),
  (13,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-client_discovery_report'),
  (14,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-client_discovery_report'),
  (15,'REBUILD','DOC-BASE','document_template','doc-template-system-en-client_final_report'),
  (16,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-client_final_report'),
  (17,'REBUILD','DOC-BASE','document_template','doc-template-system-en-decision_memo'),
  (18,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-decision_memo'),
  (19,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-digital_transformation_roadmap'),
  (20,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-digital_transformation_roadmap'),
  (21,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-due_diligence_note'),
  (22,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-due_diligence_note'),
  (23,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-executive_memo'),
  (24,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-executive_memo'),
  (25,'REBUILD','DOC-BASE','document_template','doc-template-system-en-implementation_plan'),
  (26,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-implementation_plan'),
  (27,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-internal_policy_document'),
  (28,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-internal_policy_document'),
  (29,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-interview_summary_report'),
  (30,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-interview_summary_report'),
  (31,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-portfolio_overview'),
  (32,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-portfolio_overview'),
  (33,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-project_status_report'),
  (34,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-project_status_report'),
  (35,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-research_report'),
  (36,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-research_report'),
  (37,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-risk_register_report'),
  (38,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-risk_register_report'),
  (39,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-sales_proposal'),
  (40,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-sales_proposal'),
  (41,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-sop_document'),
  (42,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-sop_document'),
  (43,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-steering_committee_report'),
  (44,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-steering_committee_report'),
  (45,'DEPRECATE','DOC-BASE','document_template','doc-template-system-en-workshop_summary'),
  (46,'DEPRECATE','DOC-BASE','document_template','doc-template-system-pl-workshop_summary'),
  (47,'KEEP','DOC-BASE','report_template','tpl-assessment-default'),
  (48,'KEEP','DOC-BASE','report_template','tpl-assessment-summary-v2'),
  (49,'REBUILD','DOC-BASE','report_template','dbr77-doc-audit-report'),
  (50,'DEPRECATE','DOC-BASE','report_template','mck-doc-business-case'),
  (51,'KEEP','DOC-BASE','report_template','tpl-drd-board-report-v2'),
  (52,'KEEP','DOC-BASE','report_template','tpl-drd-full-diagnostic-v2'),
  (53,'REBUILD','DECK-BASE','report_template','tpl-drd-presentation-v2'),
  (54,'DEPRECATE','DOC-BASE','report_template','mck-doc-diagnostic'),
  (55,'DEPRECATE','DOC-BASE','report_template','mck-doc-exec-summary'),
  (56,'REBUILD','DOC-BASE','report_template','dbr77-doc-exec-memo'),
  (57,'KEEP','DOC-BASE','report_template','tpl-final-transformation-report'),
  (58,'KEEP','DOC-BASE','report_template','tpl-finance-section'),
  (59,'DEPRECATE','DOC-BASE','report_template','tpl-financial-analysis'),
  (60,'KEEP','DOC-BASE','report_template','tpl-financial-analysis-export'),
  (61,'KEEP','DOC-BASE','report_template','tpl-interview-detailed'),
  (62,'KEEP','DOC-BASE','report_template','tpl-interview-summary'),
  (63,'KEEP','DOC-BASE','report_template','tpl-results-kpi-report-default'),
  (64,'KEEP','DOC-BASE','report_template','tpl-pm-weekly'),
  (65,'DEPRECATE','DOC-BASE','report_template','mck-doc-pmo-weekly'),
  (66,'KEEP','DOC-BASE','report_template','tpl-program-3axis'),
  (67,'DEPRECATE','DOC-BASE','report_template','tpl-results-kpi-review'),
  (68,'DEPRECATE','DOC-BASE','report_template','mck-doc-sponsor-onepager'),
  (69,'KEEP','DOC-BASE','report_template','tpl-pm-sponsor-onepager'),
  (70,'DEPRECATE','DOC-BASE','report_template','dbr77-doc-status-report'),
  (71,'KEEP','DOC-BASE','report_template','tpl-steering-committee'),
  (72,'DEPRECATE','DOC-BASE','report_template','mck-doc-steering-update'),
  (73,'KEEP','DOC-BASE','report_template','tpl-pm-steering'),
  (74,'KEEP','DOC-BASE','report_template','tpl-strategic-review-exec'),
  (75,'KEEP','DOC-BASE','report_template','tpl-tool-comparison'),
  (76,'KEEP','DOC-BASE','report_template','tpl-tool-evaluation'),
  (77,'KEEP','DOC-BASE','report_template','tpl-tool-workshop-summary'),
  (78,'KEEP','DOC-BASE','report_template','tpl-transformation-roadmap'),
  (79,'DEPRECATE','DOC-BASE','report_template','tpl-valuation-pack'),
  (80,'REBUILD','DECK-BASE','presentation_template','pt-assessment'),
  (81,'REBUILD','DECK-BASE','presentation_template','dbr77-deck-board'),
  (82,'DEPRECATE','DECK-BASE','presentation_template','dbr77-deck-diagnostic'),
  (83,'DEPRECATE','DECK-BASE','presentation_template','mck-deck-final-report'),
  (84,'DEPRECATE','DECK-BASE','presentation_template','mck-deck-findings-readout'),
  (85,'DEPRECATE','DECK-BASE','presentation_template','dbr77-deck-investor-pitch'),
  (86,'DEPRECATE','DECK-BASE','presentation_template','mck-deck-kickoff'),
  (87,'DEPRECATE','DECK-BASE','presentation_template','pt-program'),
  (88,'DEPRECATE','DECK-BASE','presentation_template','mck-deck-recommendation'),
  (89,'DEPRECATE','DECK-BASE','presentation_template','pt-steering'),
  (90,'DEPRECATE','DECK-BASE','presentation_template','mck-deck-steering-review'),
  (91,'DEPRECATE','DECK-BASE','presentation_template','pt-tool-workshop'),
  (92,'DEPRECATE','DECK-BASE','presentation_template','pt-valuation')
) AS inventory(nr, decision, family, runtime, source_id);

-- Artifact-backed organization inventory #93-#96. Resolve, never invent.
INSERT INTO tmp_template96 (nr, decision, family, runtime, artifact_id)
VALUES
  (93,'REBUILD','DECK-BASE','presentation_template','fe1bff79-af1c-475b-b977-7437964e744a'),
  (94,'REBUILD','DECK-BASE','presentation_template','26499c9e-4915-4ec4-9ebf-4d6f5873e3c3'),
  (95,'REBUILD','SHEET-BASE','sheet_template','0a757a44-2ef4-466a-9231-dff14b89e515'),
  (96,'REBUILD','SHEET-BASE','sheet_template','b245853a-b52f-4e73-9a3d-43b9e72ed98d');

DO $$
DECLARE
  denominator INTEGER;
  keep_count INTEGER;
  rebuild_count INTEGER;
  deprecate_count INTEGER;
  unresolved TEXT;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE decision='KEEP'),
         count(*) FILTER (WHERE decision='REBUILD'),
         count(*) FILTER (WHERE decision='DEPRECATE')
    INTO denominator, keep_count, rebuild_count, deprecate_count
    FROM tmp_template96;
  IF (denominator, keep_count, rebuild_count, deprecate_count) <> (96,20,16,60) THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: denominator mismatch %/%/%/%', denominator, keep_count, rebuild_count, deprecate_count;
  END IF;

  SELECT string_agg(i.nr::text, ',' ORDER BY i.nr) INTO unresolved
    FROM tmp_template96 i
   WHERE i.nr <= 92 AND CASE i.runtime
     WHEN 'document_template' THEN (SELECT count(*) FROM document_studio_templates s WHERE s.template_id=i.source_id) <> 1
     WHEN 'report_template' THEN (SELECT count(*) FROM report_builder_templates s WHERE s.id=i.source_id) <> 1
     WHEN 'presentation_template' THEN (SELECT count(*) FROM presentation_templates s WHERE s.id=i.source_id) <> 1
     ELSE TRUE END;
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: source must resolve exactly once for inventory rows [%]', unresolved;
  END IF;

  SELECT string_agg(i.nr::text, ',' ORDER BY i.nr) INTO unresolved
    FROM tmp_template96 i
   WHERE i.nr >= 93 AND (
     (SELECT count(*) FROM v8_output_artifacts a WHERE a.artifact_id=i.artifact_id) <> 1 OR
     (SELECT count(*) FROM v8_artifact_origin_links l
       WHERE l.artifact_id=i.artifact_id AND l.origin_runtime=i.runtime) <> 1
   );
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: #93-#96 require one artifact and one expected origin link; failed rows [%]', unresolved;
  END IF;

  UPDATE tmp_template96 i
     SET source_id = l.origin_record_id
    FROM v8_artifact_origin_links l
   WHERE i.nr >= 93 AND l.artifact_id=i.artifact_id AND l.origin_runtime=i.runtime;

  SELECT string_agg(i.nr::text, ',' ORDER BY i.nr) INTO unresolved
    FROM tmp_template96 i
   WHERE i.nr >= 93 AND CASE i.runtime
     WHEN 'presentation_template' THEN (SELECT count(*) FROM presentation_templates s WHERE s.id=i.source_id) <> 1
     WHEN 'sheet_template' THEN (SELECT count(*) FROM tp_base_templates s WHERE s.id::text=i.source_id) <> 1
     ELSE TRUE END;
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: resolved #93-#96 source must exist exactly once; failed rows [%]', unresolved;
  END IF;

  SELECT string_agg(duplicates.rows, ';' ORDER BY duplicates.rows) INTO unresolved
    FROM (
      SELECT string_agg(i.nr::text, ',' ORDER BY i.nr) AS rows
        FROM tmp_template96 i
       GROUP BY i.runtime,i.source_id
      HAVING count(*) > 1
    ) duplicates;
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: runtime/source pairs must be unique across fullName=96; duplicate rows [%]', unresolved;
  END IF;

  IF (SELECT count(*) FROM document_studio_templates
       WHERE template_id='doc-template-system-en-client_final_report' AND status='approved') <> 1
     OR (SELECT count(*) FROM presentation_templates
          WHERE id='dbr77-deck-board' AND lifecycle_state='approved') <> 1
     OR (SELECT count(*) FROM tp_base_templates
          WHERE id='2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid AND status='approved') <> 1 THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: approved DOC-BASE, DECK-BASE and SHEET-BASE from 20262271 are required';
  END IF;

  SELECT string_agg(i.nr::text, ',' ORDER BY i.nr) INTO unresolved
    FROM tmp_template96 i
    JOIN report_builder_templates s ON i.runtime='report_template' AND i.source_id=s.id
   WHERE i.decision='KEEP' AND NOT s.is_active;
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: KEEP report sources must still be active; failed rows [%]', unresolved;
  END IF;

  SELECT string_agg(i.nr::text, ',' ORDER BY i.nr) INTO unresolved
    FROM tmp_template96 i
   WHERE NOT EXISTS (
     SELECT 1
       FROM v8_artifact_origin_links l
       JOIN v8_output_artifacts a
         ON a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id
      WHERE l.origin_runtime=i.runtime AND l.origin_record_id=i.source_id
   );
  IF unresolved IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1b preflight: every inventory row requires an existing linked snapshot; failed rows [%]', unresolved;
  END IF;
END $$;

-- Lock all resolved sources and inventory snapshots after the full preflight.
SELECT 1 FROM document_studio_templates s JOIN tmp_template96 i
  ON i.runtime='document_template' AND i.source_id=s.template_id FOR UPDATE;
SELECT 1 FROM report_builder_templates s JOIN tmp_template96 i
  ON i.runtime='report_template' AND i.source_id=s.id FOR UPDATE;
SELECT 1 FROM presentation_templates s JOIN tmp_template96 i
  ON i.runtime='presentation_template' AND i.source_id=s.id FOR UPDATE;
SELECT 1 FROM tp_base_templates s JOIN tmp_template96 i
  ON i.runtime='sheet_template' AND i.source_id=s.id::text FOR UPDATE;
SELECT 1 FROM v8_output_artifacts a JOIN v8_artifact_origin_links l
  ON l.artifact_id=a.artifact_id AND l.organization_id=a.organization_id
  JOIN tmp_template96 i ON i.runtime=l.origin_runtime AND i.source_id=l.origin_record_id
  FOR UPDATE;

-- Deprecate 60 source records. Payloads remain intact.
UPDATE document_studio_templates s
   SET status='deprecated', deprecated_at=COALESCE(deprecated_at,TIMESTAMPTZ '2026-09-16 00:00:00+00'),
       deprecated_by=COALESCE(deprecated_by,'CTO:W118'), updated_at=TIMESTAMPTZ '2026-09-16 00:00:00+00'
  FROM tmp_template96 i
 WHERE i.decision='DEPRECATE' AND i.runtime='document_template' AND s.template_id=i.source_id;

UPDATE report_builder_templates s
   SET is_active=FALSE, is_default=FALSE, updated_at=TIMESTAMP '2026-09-16 00:00:00'
  FROM tmp_template96 i
 WHERE i.decision='DEPRECATE' AND i.runtime='report_template' AND s.id=i.source_id;

UPDATE presentation_templates s
   SET is_active=FALSE, lifecycle_state='deprecated',
       deprecated_at=COALESCE(deprecated_at,TIMESTAMPTZ '2026-09-16 00:00:00+00'),
       deprecated_by=COALESCE(deprecated_by,'CTO:W118'),
       deprecation_reason=COALESCE(deprecation_reason,'TEMPLATE-1 inventory cleanup W118'),
       updated_at=TIMESTAMP '2026-09-16 00:00:00'
  FROM tmp_template96 i
 WHERE i.decision='DEPRECATE' AND i.runtime='presentation_template' AND s.id=i.source_id;

-- Rebuild profiles inherit a base family but remain draft until a live-object
-- test passes. The already-proven base rows #15/#81 stay approved and active.
UPDATE document_studio_templates s
   SET language='en', status='draft', approved_by=NULL, approved_at=NULL,
       deprecated_by=NULL, deprecated_at=NULL,
       formatting_schema=jsonb_set(COALESCE(s.formatting_schema,'{}'::jsonb),'{templateFamily}','"DOC-BASE"'::jsonb,true),
       export_rules=jsonb_set(COALESCE(s.export_rules,'{}'::jsonb),'{contentPolicy}','"replace-content-not-layout"'::jsonb,true),
       provenance_status='approved',
       provenance_json=jsonb_build_object('authority','KANAL.md W108/W118','actor','CTO / Codex-2','version','template-1b-v1','evidence','INWENTARZ.csv row '||i.nr),
       updated_at=TIMESTAMPTZ '2026-09-16 00:00:00+00'
  FROM tmp_template96 i
 WHERE i.decision='REBUILD' AND i.runtime='document_template'
   AND i.nr <> 15 AND s.template_id=i.source_id;

UPDATE report_builder_templates s
   SET is_active=TRUE, is_default=FALSE,
       default_options_json=jsonb_set(COALESCE(NULLIF(s.default_options_json,'')::jsonb,'{}'::jsonb),'{templateFamily}',to_jsonb(i.family),true)::text,
       provenance_status='approved',
       provenance_json=jsonb_build_object('authority','KANAL.md W108/W118','actor','CTO / Codex-2','version','template-1b-v1','evidence','INWENTARZ.csv row '||i.nr),
       updated_at=TIMESTAMP '2026-09-16 00:00:00'
  FROM tmp_template96 i
 WHERE i.decision='REBUILD' AND i.runtime='report_template'
   AND i.nr IN (49,56) AND s.id=i.source_id;

UPDATE presentation_templates s
   SET language_default='en', is_active=TRUE, lifecycle_state='draft',
       approved_at=NULL, approved_by=NULL, deprecated_at=NULL, deprecated_by=NULL, deprecation_reason=NULL,
       template_family='DECK-BASE',
       layout_policy_json=jsonb_set(COALESCE(NULLIF(s.layout_policy_json,'')::jsonb,'{}'::jsonb),'{family}','"DECK-BASE"'::jsonb,true)::text,
       provenance_status='approved',
       provenance_json=jsonb_build_object('authority','KANAL.md W108/W118','actor','CTO / Codex-2','version','template-1b-v1','evidence','INWENTARZ.csv row '||i.nr),
       updated_at=TIMESTAMP '2026-09-16 00:00:00'
  FROM tmp_template96 i
 WHERE i.decision='REBUILD' AND i.runtime='presentation_template'
   AND i.nr NOT IN (81) AND s.id=i.source_id;

UPDATE tp_base_templates s
   SET language='en', status='draft',
       schema_snapshot=(SELECT b.schema_snapshot || jsonb_build_object('profile',s.name,'contentPolicy','replace-data-not-layout')
                          FROM tp_base_templates b WHERE b.id='2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid),
       governance_rules=jsonb_set(COALESCE(s.governance_rules,'{}'::jsonb),'{family}','"SHEET-BASE"'::jsonb,true),
       provenance_status='approved',
       provenance_json=jsonb_build_object('authority','KANAL.md W108/W118','actor','CTO / Codex-2','version','template-1b-v1','evidence','INWENTARZ.csv row '||i.nr)
  FROM tmp_template96 i
 WHERE i.decision='REBUILD' AND i.runtime='sheet_template' AND s.id::text=i.source_id;

-- #53 additive format transition. The old report card stays active until a
-- live equivalence test passes; the new deck card is draft, so there are never
-- two active cards for one caller.
INSERT INTO presentation_templates (
  id, organization_id, name, description, deck_type, audience, goal,
  language_default, confidentiality_default, theme, outline_json,
  max_slides, min_slides, must_have_intents, recommended_visuals,
  is_system, is_active, created_by, updated_at, lifecycle_state,
  lineage_root_id, visibility, template_family, template_recipe_json,
  layout_policy_json, source_requirements_json, provenance_status, provenance_json
)
SELECT 'pt-drd-presentation-v2', NULL, 'DRD Presentation Deck',
       'DRD assessment presentation profile inheriting the DECK-BASE layout.',
       'assessment_drd', 'executive', 'align', 'en', 'internal', 'corporate',
       b.outline_json, 25, 8, '["cover","agenda","decision"]',
       '["native_table","native_chart","roadmap_band"]', TRUE, TRUE,
       'migration:20262272_template_library_cleanup_96', TIMESTAMP '2026-09-16 00:00:00',
       'draft', 'pt-drd-presentation-v2', 'system', 'DECK-BASE',
       '{"contentPolicy":"replace-content-not-layout","sourceProfile":"tpl-drd-presentation-v2"}',
       b.layout_policy_json, '["assessment","findings","recommendations","roadmap"]',
       'approved',
       '{"authority":"KANAL.md W108/W118","actor":"CTO / Codex-2","version":"template-1b-v1","evidence":"INWENTARZ.csv row 53"}'::jsonb
  FROM presentation_templates b WHERE b.id='dbr77-deck-board'
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, deck_type=EXCLUDED.deck_type,
  language_default='en', is_system=TRUE, is_active=TRUE, lifecycle_state='draft',
  approved_at=NULL, approved_by=NULL, deprecated_at=NULL, deprecated_by=NULL, deprecation_reason=NULL,
  template_family='DECK-BASE', template_recipe_json=EXCLUDED.template_recipe_json,
  layout_policy_json=EXCLUDED.layout_policy_json, source_requirements_json=EXCLUDED.source_requirements_json,
  provenance_status='approved', provenance_json=EXCLUDED.provenance_json,
  updated_at=TIMESTAMP '2026-09-16 00:00:00';

WITH old_cards AS (
  SELECT a.organization_id,
         'template-1-drddraft-'||md5(a.organization_id||':pt-drd-presentation-v2') artifact_id
    FROM v8_output_artifacts a
    JOIN v8_artifact_origin_links l ON l.artifact_id=a.artifact_id AND l.organization_id=a.organization_id
   WHERE l.origin_runtime='report_template' AND l.origin_record_id='tpl-drd-presentation-v2'
)
INSERT INTO v8_output_artifacts (
  artifact_id,organization_id,output_type,delivery_state,template_family_ref,
  created_by,created_at,last_transition_at,artifact_family,title_snapshot,
  canonical_home,visibility_scope,origin_summary_json,is_draft
)
SELECT artifact_id,organization_id,'presentation','draft','DECK-BASE',
       'migration:20262272_template_library_cleanup_96',TIMESTAMP '2026-09-16 00:00:00'::text,
       TIMESTAMP '2026-09-16 00:00:00'::text,'template','DRD Presentation Deck',
       'outputs_library','organization',
       jsonb_build_object('template',jsonb_build_object('family','DECK-BASE','status','draft','language','en','sourceRuntime','presentation_template','sourceId','pt-drd-presentation-v2','replaces','tpl-drd-presentation-v2'))::text,1
  FROM old_cards
ON CONFLICT (artifact_id) DO UPDATE SET
  delivery_state='draft',template_family_ref='DECK-BASE',artifact_family='template',
  title_snapshot='DRD Presentation Deck',origin_summary_json=EXCLUDED.origin_summary_json,is_draft=1;

WITH draft_cards AS (
  SELECT artifact_id,organization_id FROM v8_output_artifacts
   WHERE artifact_id LIKE 'template-1-drddraft-%' AND title_snapshot='DRD Presentation Deck'
)
INSERT INTO v8_artifact_origin_links (
  link_id,artifact_id,organization_id,origin_runtime,origin_record_id,is_primary_origin,created_at
)
SELECT 'template-1-drddraft-link-'||md5(organization_id),artifact_id,organization_id,
       'presentation_template','pt-drd-presentation-v2',1,TIMESTAMP '2026-09-16 00:00:00'::text
  FROM draft_cards
ON CONFLICT (organization_id,origin_runtime,origin_record_id) DO UPDATE SET
  artifact_id=EXCLUDED.artifact_id,is_primary_origin=1;

-- Snapshot layer: KEEP stays active; DEPRECATE is hidden; REBUILD is draft
-- until live-object acceptance. Base rows #15/#81 remain active.
UPDATE v8_output_artifacts a
   SET template_family_ref=i.family,
       is_draft=CASE WHEN i.decision='KEEP' OR i.nr IN (15,81) THEN 0 ELSE 1 END,
       delivery_state=CASE WHEN i.decision='DEPRECATE' THEN 'archived'
                           WHEN i.decision='KEEP' OR i.nr IN (15,81) THEN 'ready' ELSE 'draft' END,
       origin_summary_json=(
         CASE WHEN a.origin_summary_json IS NOT NULL AND a.origin_summary_json LIKE '{%'
              THEN a.origin_summary_json::jsonb ELSE '{}'::jsonb END
         || jsonb_build_object('template',
              COALESCE(CASE WHEN a.origin_summary_json IS NOT NULL AND a.origin_summary_json LIKE '{%'
                            THEN a.origin_summary_json::jsonb->'template' END,'{}'::jsonb)
              || jsonb_build_object('family',i.family,
                   'status',CASE WHEN i.decision='DEPRECATE' THEN 'deprecated'
                                 WHEN i.decision='KEEP' OR i.nr IN (15,81) THEN 'approved' ELSE 'draft' END,
                   'inventoryRow',i.nr)))::text,
       last_transition_at=TIMESTAMP '2026-09-16 00:00:00'::text
  FROM v8_artifact_origin_links l JOIN tmp_template96 i
    ON i.runtime=l.origin_runtime AND i.source_id=l.origin_record_id
 WHERE a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id;

-- Exactly one active RESULTS_KPI_REPORT default.
UPDATE report_builder_templates SET is_default=TRUE,is_active=TRUE
 WHERE id='tpl-results-kpi-report-default';
UPDATE report_builder_templates SET is_default=FALSE,is_active=FALSE
 WHERE id='tpl-results-kpi-review';
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_builder_templates_one_active_results_kpi_default
  ON report_builder_templates((1))
  WHERE source_type='RESULTS_KPI_REPORT' AND report_type='RESULTS_KPI_REPORT'
    AND is_default=TRUE AND is_active=TRUE;

DO $$
DECLARE
  source_deprecated INTEGER;
  snapshot_deprecated INTEGER;
  active_kept INTEGER;
  draft_rebuild INTEGER;
BEGIN
  SELECT
    (SELECT count(*) FROM document_studio_templates s JOIN tmp_template96 i ON i.runtime='document_template' AND i.source_id=s.template_id WHERE i.decision='DEPRECATE' AND s.status='deprecated') +
    (SELECT count(*) FROM report_builder_templates s JOIN tmp_template96 i ON i.runtime='report_template' AND i.source_id=s.id WHERE i.decision='DEPRECATE' AND NOT s.is_active) +
    (SELECT count(*) FROM presentation_templates s JOIN tmp_template96 i ON i.runtime='presentation_template' AND i.source_id=s.id WHERE i.decision='DEPRECATE' AND NOT s.is_active AND s.lifecycle_state='deprecated')
    INTO source_deprecated;
  IF source_deprecated <> 60 THEN
    RAISE EXCEPTION 'TEMPLATE-1b readback: expected 60 deprecated sources, found %',source_deprecated;
  END IF;

  SELECT count(DISTINCT i.nr) INTO snapshot_deprecated
    FROM tmp_template96 i JOIN v8_artifact_origin_links l ON l.origin_runtime=i.runtime AND l.origin_record_id=i.source_id
    JOIN v8_output_artifacts a ON a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id
   WHERE i.decision='DEPRECATE' AND a.is_draft=1 AND a.delivery_state='archived';
  IF snapshot_deprecated <> 60 THEN
    RAISE EXCEPTION 'TEMPLATE-1b readback: expected snapshots for 60 deprecated inventory rows, found %',snapshot_deprecated;
  END IF;

  SELECT count(DISTINCT i.nr) INTO active_kept
    FROM tmp_template96 i JOIN v8_artifact_origin_links l ON l.origin_runtime=i.runtime AND l.origin_record_id=i.source_id
    JOIN v8_output_artifacts a ON a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id
   WHERE (i.decision='KEEP' OR i.nr IN (15,81)) AND a.is_draft=0 AND a.template_family_ref=i.family;
  IF active_kept <> 22 THEN
    RAISE EXCEPTION 'TEMPLATE-1b readback: expected 22 proven active inventory rows, found %',active_kept;
  END IF;

  SELECT count(DISTINCT i.nr) INTO draft_rebuild
    FROM tmp_template96 i JOIN v8_artifact_origin_links l ON l.origin_runtime=i.runtime AND l.origin_record_id=i.source_id
    JOIN v8_output_artifacts a ON a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id
   WHERE i.decision='REBUILD' AND i.nr NOT IN (15,53,81)
     AND a.is_draft=1 AND a.template_family_ref=i.family;
  IF draft_rebuild <> 13 THEN
    RAISE EXCEPTION 'TEMPLATE-1b readback: expected 13 rebuilt draft inventory rows, found %',draft_rebuild;
  END IF;

  IF EXISTS (
    SELECT a.organization_id
      FROM v8_output_artifacts a JOIN v8_artifact_origin_links l
        ON l.artifact_id=a.artifact_id AND l.organization_id=a.organization_id
     WHERE l.origin_record_id IN ('tpl-drd-presentation-v2','pt-drd-presentation-v2') AND a.is_draft=0
     GROUP BY a.organization_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1b readback: duplicate active DRD presentation card';
  END IF;

  IF (SELECT count(*) FROM report_builder_templates WHERE source_type='RESULTS_KPI_REPORT' AND report_type='RESULTS_KPI_REPORT' AND is_default AND is_active) <> 1 THEN
    RAISE EXCEPTION 'TEMPLATE-1b readback: active RESULTS_KPI_REPORT default must equal one';
  END IF;
END $$;

COMMIT;
