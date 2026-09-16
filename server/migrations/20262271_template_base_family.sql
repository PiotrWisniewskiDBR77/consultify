-- TEMPLATE-1 / W108 + W118: three approved, English, system template bases.
--
-- The source registries remain the generation SSOT. v8_output_artifacts is a
-- per-organization library snapshot and is updated in the same transaction.
-- This migration deliberately does not touch inventory items #93-#96. In
-- particular, the new SHEET-BASE is not a promotion of the Northwind #95 row.

BEGIN;

DO $migration$
DECLARE
  org_count INTEGER;
  snapshot_count INTEGER;
  link_count INTEGER;
  draft_count_before INTEGER;
  draft_count_after INTEGER;
  sheet_template_count INTEGER;
  sheet_template_english_count INTEGER;
  backup_initialized BOOLEAN;
BEGIN
  IF to_regclass('public.document_studio_templates') IS NULL
     OR to_regclass('public.presentation_templates') IS NULL
     OR to_regclass('public.tp_base_templates') IS NULL
     OR to_regclass('public.v8_output_artifacts') IS NULL
     OR to_regclass('public.v8_artifact_origin_links') IS NULL
     OR to_regclass('public.organizations') IS NULL THEN
    RAISE NOTICE 'TEMPLATE-1 no-op: a required template/artifact table is missing';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM document_studio_templates
     WHERE template_id = 'doc-template-system-en-client_final_report'
  ) THEN
    RAISE NOTICE 'TEMPLATE-1 no-op: canonical DOC-BASE source is missing; runtime seeder remains authoritative';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM presentation_templates WHERE id = 'dbr77-deck-board'
  ) THEN
    RAISE NOTICE 'TEMPLATE-1 no-op: canonical DECK-BASE source is missing; runtime seeder remains authoritative';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations) THEN
    RAISE NOTICE 'TEMPLATE-1 no-op: no organizations available for snapshots';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS template_1_20262271_backup (
    entity_type TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    _backup JSONB NOT NULL,
    backed_up_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_type, entity_key)
  );

ALTER TABLE tp_base_templates
  ADD COLUMN IF NOT EXISTS language TEXT;

ALTER TABLE tp_base_templates
  ALTER COLUMN language DROP DEFAULT,
  ALTER COLUMN language DROP NOT NULL;

COMMENT ON COLUMN tp_base_templates.language IS
  'BCP-47 language of the workbook template payload; NULL means unmeasured legacy language.';

SELECT count(*), count(*) FILTER (WHERE language = 'en')
  INTO sheet_template_count, sheet_template_english_count
  FROM tp_base_templates;
RAISE NOTICE 'TEMPLATE-1 language baseline: % rows, % already measured as en; legacy rows remain unchanged',
  sheet_template_count, sheet_template_english_count;

SELECT EXISTS (
  SELECT 1 FROM template_1_20262271_backup
   WHERE entity_type = 'migration_state' AND entity_key = 'initialized'
) INTO backup_initialized;

IF NOT backup_initialized THEN
INSERT INTO template_1_20262271_backup (entity_type, entity_key, _backup)
SELECT 'document_studio_template', template_id, to_jsonb(t)
  FROM document_studio_templates t
 WHERE template_id = 'doc-template-system-en-client_final_report'
ON CONFLICT DO NOTHING;

INSERT INTO template_1_20262271_backup (entity_type, entity_key, _backup)
SELECT 'presentation_template', id, to_jsonb(t)
  FROM presentation_templates t
 WHERE id = 'dbr77-deck-board'
ON CONFLICT DO NOTHING;

INSERT INTO template_1_20262271_backup (entity_type, entity_key, _backup)
SELECT 'sheet_template', id::text, to_jsonb(t)
  FROM tp_base_templates t
 WHERE id = '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid
ON CONFLICT DO NOTHING;

INSERT INTO template_1_20262271_backup (entity_type, entity_key, _backup)
SELECT 'origin_link', link_id, to_jsonb(l)
  FROM v8_artifact_origin_links l
 WHERE (origin_runtime, origin_record_id) IN (
   ('document_template','doc-template-system-en-client_final_report'),
   ('presentation_template','dbr77-deck-board'),
   ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
 )
ON CONFLICT DO NOTHING;

INSERT INTO template_1_20262271_backup (entity_type, entity_key, _backup)
SELECT DISTINCT 'output_artifact', a.artifact_id, to_jsonb(a)
  FROM v8_output_artifacts a
  JOIN v8_artifact_origin_links l
    ON l.artifact_id = a.artifact_id
   AND l.organization_id = a.organization_id
 WHERE (l.origin_runtime, l.origin_record_id) IN (
   ('document_template','doc-template-system-en-client_final_report'),
   ('presentation_template','dbr77-deck-board'),
   ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
 )
ON CONFLICT DO NOTHING;

INSERT INTO template_1_20262271_backup (entity_type, entity_key, _backup)
VALUES ('migration_state', 'initialized', '{"version":1}'::jsonb);
END IF;

SELECT count(*) INTO draft_count_before
  FROM v8_output_artifacts a
  JOIN v8_artifact_origin_links l
    ON l.artifact_id = a.artifact_id
   AND l.organization_id = a.organization_id
 WHERE a.is_draft = 1
   AND (l.origin_runtime, l.origin_record_id) IN (
     ('document_template','doc-template-system-en-client_final_report'),
     ('presentation_template','dbr77-deck-board'),
     ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
   );

UPDATE document_studio_templates
   SET organization_id = '__system__',
       name = '[System] Client final report (EN)',
       category = 'report',
       document_type = 'client_final_report',
       purpose = 'Board-ready client report with a fixed eight-section structure.',
       audience = '["Client Sponsor", "Executive Team"]'::jsonb,
       language = 'en',
       language_style = 'consulting',
       communication_register = 'executive',
       density = 'comprehensive',
       confidentiality = 'client_confidential',
       required_inputs = '["scope statement", "methodology", "findings", "recommendations"]'::jsonb,
       section_blueprint = $json$[
         {"key":"executive-summary","level":1,"title":"Executive Summary","purpose":"Decision-ready synthesis of the case and recommendation.","required":true,"expectedLengthHint":"medium"},
         {"key":"context-scope","level":1,"title":"Context and Scope","purpose":"Client context, objectives, scope and constraints.","required":true,"expectedLengthHint":"medium"},
         {"key":"methodology","level":1,"title":"Methodology","purpose":"Evidence sources, method and limitations.","required":true,"expectedLengthHint":"short"},
         {"key":"findings","level":1,"title":"Findings","purpose":"Evidence-backed findings grouped by decision theme.","required":true,"expectedLengthHint":"long"},
         {"key":"maturity-matrix","level":1,"title":"Maturity Matrix","purpose":"Current and target state with gaps and evidence.","required":true,"expectedLengthHint":"medium"},
         {"key":"recommendations","level":1,"title":"Recommendations","purpose":"Prioritized recommendations with rationale and owner.","required":true,"expectedLengthHint":"long"},
         {"key":"roadmap","level":1,"title":"Roadmap","purpose":"Sequenced actions, milestones, owners and acceptance criteria.","required":true,"expectedLengthHint":"medium"},
         {"key":"appendix","level":1,"title":"Appendix","purpose":"Supporting evidence, definitions and source notes.","required":false,"expectedLengthHint":"long"}
       ]$json$::jsonb,
       formatting_schema = $json${
         "family":"DOC-BASE",
         "layoutContractVersion":"template-1-v1",
         "coverPage":true,
         "toc":{"enabled":true,"live":true},
         "page":{"size":"A4","marginsCm":{"top":2,"right":2.3,"bottom":2,"left":2.3}},
         "themeFonts":{"majorLatin":"Aptos Display","minorLatin":"Aptos","fallback":"Arial"},
         "docDefaults":{"asciiTheme":"minorHAnsi","hAnsiTheme":"minorHAnsi","eastAsiaTheme":"minorEastAsia","csTheme":"minorBidi"},
         "fontTable":{"Aptos":{"altName":"Arial"},"Aptos Display":{"altName":"Arial"}},
         "headingStyles":{"h1":"16pt bold numbered","h2":"13pt bold numbered","h3":"11pt bold"},
         "table":{"style":"consultify_clean_table","repeatHeader":true,"cantSplitRows":true},
         "chartSlot":true,
         "headers":{"enabled":true,"brand":"Consultify/DBR77"},
         "footers":{"enabled":true,"pageNumbering":true,"confidentialityLabel":true,"clientLogoToken":"client_logo","clientLogoSource":"organizations.logo_url","organizationNameToken":"organization_name"},
         "contentPolicy":"replace-content-not-layout"
       }$json$::jsonb,
       export_rules = $json${
         "docx":true,"pdf":true,"markdown":true,
         "defaultFormat":"docx","approvalRequiredForExport":true,
         "fontContract":"theme-aptos-with-arial-altName",
         "coBranding":{"coverBrand":"Consultify/DBR77","footerClientLogoToken":"client_logo","clientLogoSource":"organizations.logo_url"}
       }$json$::jsonb,
       status = 'approved',
       version = '1.0',
       updated_at = TIMESTAMPTZ '2026-09-16 00:00:00+00',
       approved_by = 'CTO:W118',
       approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
       deprecated_by = NULL,
       deprecated_at = NULL,
       notes = 'TEMPLATE-1 DOC-BASE; accepted mockup 2026-09-16; content changes, layout stays fixed.',
       is_system = TRUE,
       provenance_status = 'approved',
       provenance_json = $json${
         "authority":"KANAL.md W108/W113/W118",
         "actor":"CTO / Codex-2",
         "version":"template-1-v1",
         "evidence":"docs/plans/TEMPLATE_1_KROK0_20260916.md",
         "acceptedAt":"2026-09-16"
       }$json$::jsonb
 WHERE template_id = 'doc-template-system-en-client_final_report';

UPDATE presentation_templates
   SET organization_id = NULL,
       name = 'Board deck',
       description = 'Board-ready eight-layout system deck. Modules replace content, not layout.',
       deck_type = 'board_presentation',
       audience = 'executive',
       goal = 'align',
       language_default = 'en',
       confidentiality_default = 'internal',
       theme = 'corporate',
       outline_json = $json$[
         {"intent":"cover","title":"Cover","layoutRole":"cover"},
         {"intent":"agenda","title":"Agenda","layoutRole":"agenda"},
         {"intent":"section_break","title":"Section Break","layoutRole":"section-break"},
         {"intent":"content","title":"One-column Content","layoutRole":"one-column-content"},
         {"intent":"comparison","title":"Two-column Content","layoutRole":"two-column-content"},
         {"intent":"table","title":"Evidence Table","layoutRole":"table"},
         {"intent":"chart","title":"Performance Chart","layoutRole":"chart"},
         {"intent":"decision","title":"Decision and Next Steps","layoutRole":"decision"}
       ]$json$,
       min_slides = 8,
       max_slides = 25,
       must_have_intents = '["cover","agenda","decision"]',
       recommended_visuals = '["kpi_strip","native_table","native_chart","roadmap_band"]',
       is_system = TRUE,
       is_active = TRUE,
       updated_at = TIMESTAMP '2026-09-16 00:00:00',
       lifecycle_state = 'approved',
       approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
       approved_by = 'CTO:W118',
       deprecated_at = NULL,
       deprecated_by = NULL,
       deprecation_reason = NULL,
       lineage_root_id = COALESCE(lineage_root_id, id),
       visibility = 'system',
       template_family = 'DECK-BASE',
       template_recipe_json = $json${
         "contractVersion":"template-1-v1","contentPolicy":"replace-content-not-layout",
         "layoutRoles":["cover","agenda","section-break","one-column-content","two-column-content","table","chart","decision"]
       }$json$,
       layout_policy_json = $json${
         "family":"DECK-BASE",
         "palette":{"navy":"1B2A41","text":"101828","blue":"2563EB","muted":"667085","line":"D8DEE8","surface":"F1F4F8","accentSoft":"DBE7FF","critical":"B42318"},
         "themeFonts":{"majorLatin":"Aptos Display","minorLatin":"Aptos","fallback":"Arial"},
         "runFonts":"theme-only-no-literal-font-names",
         "coBranding":{"coverBrand":"Consultify/DBR77","footerClientLogoToken":"client_logo","clientLogoSource":"organizations.logo_url"},
         "contentPolicy":"replace-content-not-layout"
       }$json$,
       source_requirements_json = '["title","decision_context","evidence","recommendation","next_steps"]',
       provenance_status = 'approved',
       provenance_json = $json${
         "authority":"KANAL.md W108/W113/W118",
         "actor":"CTO / Codex-2",
         "version":"template-1-v1",
         "evidence":"docs/plans/TEMPLATE_1_KROK0_20260916.md",
         "acceptedAt":"2026-09-16"
       }$json$::jsonb
 WHERE id = 'dbr77-deck-board';

INSERT INTO tp_base_templates (
  id, name, description, category, schema_snapshot, is_featured, usage_count,
  created_by, status, version, owner_user_id, approval_history,
  governance_rules, organization_id, visibility, language,
  provenance_status, provenance_json
) VALUES (
  '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid,
  'Supplier scorecard workbook',
  'English system workbook base with a scorecard and field map; contains no organization data.',
  'scorecard',
  $sheet${"family":"SHEET-BASE","contractVersion":"template-1-v2","language":"en","sourceSha256":"506d1ade58e98a31ba2d1e04c495dcddf7398ff51edffb015d11e4730e592b63","contentPolicy":"replace-data-not-layout","sheets":[{"key":"scorecard","name":"Supplier scorecard","dimension":"A1:K14","title":"Supplier Quality Scorecard","subtitle":"Goods-in nonconformances · Q2 to Q3 2026","headers":["Supplier","Site","Receipts Q2","NC Q2","NC rate Q2","Receipts Q3","NC Q3","NC rate Q3","Δ pp","Trend","Status"],"dataRange":"A7:K11","totalRange":"A12:K12","noteRange":"A14:K14","freeze":{"xSplit":2,"ySplit":6,"topLeftCell":"C7"},"autoFilter":"A6:K12","printTitles":null,"merges":["A14:K14","A1:K1","A2:K2","A3:K3"],"dimensions":{"columns":{"A":30,"B":14,"C":12,"D":10,"E":13,"F":12,"G":10,"H":13,"I":12,"J":14,"K":32},"rows":{"1":26,"2":16,"3":14,"4":6,"5":8,"6":30,"7":21,"8":21,"9":21,"10":21,"11":21,"12":23}},"formulas":{"E7":"IF(C7=0,\"\",D7/C7)","H7":"IF(F7=0,\"\",G7/F7)","I7":"IF(OR(C7=0,F7=0),\"\",ROUND((H7-E7)*100,1))","J7":"IF(I7=\"\",\"\",IF(I7>0.3,\"Worsening\",IF(I7<-0.3,\"Improving\",\"Stable\")))","E8":"IF(C8=0,\"\",D8/C8)","H8":"IF(F8=0,\"\",G8/F8)","I8":"IF(OR(C8=0,F8=0),\"\",ROUND((H8-E8)*100,1))","J8":"IF(I8=\"\",\"\",IF(I8>0.3,\"Worsening\",IF(I8<-0.3,\"Improving\",\"Stable\")))","E9":"IF(C9=0,\"\",D9/C9)","H9":"IF(F9=0,\"\",G9/F9)","I9":"IF(OR(C9=0,F9=0),\"\",ROUND((H9-E9)*100,1))","J9":"IF(I9=\"\",\"\",IF(I9>0.3,\"Worsening\",IF(I9<-0.3,\"Improving\",\"Stable\")))","E10":"IF(C10=0,\"\",D10/C10)","H10":"IF(F10=0,\"\",G10/F10)","I10":"IF(OR(C10=0,F10=0),\"\",ROUND((H10-E10)*100,1))","J10":"IF(I10=\"\",\"\",IF(I10>0.3,\"Worsening\",IF(I10<-0.3,\"Improving\",\"Stable\")))","E11":"IF(C11=0,\"\",D11/C11)","H11":"IF(F11=0,\"\",G11/F11)","I11":"IF(OR(C11=0,F11=0),\"\",ROUND((H11-E11)*100,1))","J11":"IF(I11=\"\",\"\",IF(I11>0.3,\"Worsening\",IF(I11<-0.3,\"Improving\",\"Stable\")))","C12":"SUM(C7:C11)","D12":"SUM(D7:D11)","E12":"D12/C12","F12":"SUM(F7:F11)","G12":"SUM(G7:G11)","H12":"G12/F12","I12":"ROUND((H12-E12)*100,1)","J12":"IF(I12>0.3,\"Worsening\",IF(I12<-0.3,\"Improving\",\"Stable\"))"},"conditionalFormats":[{"range":"H7:H11","rules":[{"type":"cellIs","operator":"greaterThan","formulas":["0.03"]},{"type":"cellIs","operator":"lessThanOrEqual","formulas":["0.02"]}]},{"range":"I7:I11","rules":[{"type":"cellIs","operator":"greaterThan","formulas":["0.3"]},{"type":"cellIs","operator":"lessThan","formulas":["-0.3"]}]},{"range":"J7:J12","rules":[{"type":"containsText","operator":"containsText","formulas":["NOT(ISERROR(SEARCH(\"Worsening\",J7)))"]},{"type":"containsText","operator":"containsText","formulas":["NOT(ISERROR(SEARCH(\"Improving\",J7)))"]}]}]},{"key":"field-map","name":"Template fields","dimension":"A1:D9","freeze":{"xSplit":0,"ySplit":1,"topLeftCell":"A2"},"autoFilter":null,"printTitles":null,"dimensions":{"columns":{"A":20,"B":22,"C":16,"D":46},"rows":{"1":24,"2":20,"3":20,"4":20,"5":20,"6":20,"7":20,"8":20,"9":20}},"rows":[["Cell / range","What it is","Owner","Bound to"],["A1","Template field","Template","Fixed title of the template"],["A2","Generator content","Generator","Reporting period selected at generation"],["A3","Template field","Template","Org name · source path · date · confidentiality label"],["A6:K6","Template field","Template","Column set, labels, widths, freeze, autofilter"],["A7:D11, F7:G11, K7:K11","Generator content","Generator","Supplier register + goods-in nonconformance records"],["E, H, I, J columns","Template formula","Template","NC rate, Δ pp and trend label — computed, never pasted"],["Row 12","Template formula","Template","SUM + weighted NC rate (not average of averages)"],["Conditional formats","Template rule","Template","Tolerance 3.0% · Δ ±0.3 pp · trend colours"]]}]}$sheet$::jsonb,
  TRUE, 0, 'migration:20262271_template_base_family', 'approved', '1.0.0',
  'system:TEMPLATE-1',
  '[{"event":"approved","at":"2026-09-16","actor":"CTO:W118","evidence":"KANAL.md W108/W113/W118"}]'::jsonb,
  $json${
    "family":"SHEET-BASE","language":"en","system":true,
    "readOnly":true,"duplicateAllowed":true,
    "fontContract":"theme-aptos-no-literal-fonts-renderer-fallback-arial",
    "coBranding":{"coverBrand":"Consultify/DBR77","clientLogoToken":"client_logo","clientLogoSource":"organizations.logo_url"},
    "contentPolicy":"replace-data-not-layout"
  }$json$::jsonb,
  '__system__', 'system', 'en', 'approved',
  $json${
    "authority":"KANAL.md W108/W113/W118",
    "actor":"CTO / Codex-2",
    "version":"template-1-v1",
    "evidence":"docs/plans/TEMPLATE_1_KROK0_20260916.md",
    "acceptedAt":"2026-09-16"
  }$json$::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  schema_snapshot = EXCLUDED.schema_snapshot,
  is_featured = EXCLUDED.is_featured,
  created_by = EXCLUDED.created_by,
  status = EXCLUDED.status,
  version = EXCLUDED.version,
  owner_user_id = EXCLUDED.owner_user_id,
  approval_history = EXCLUDED.approval_history,
  governance_rules = EXCLUDED.governance_rules,
  organization_id = EXCLUDED.organization_id,
  visibility = EXCLUDED.visibility,
  language = EXCLUDED.language,
  provenance_status = EXCLUDED.provenance_status,
  provenance_json = EXCLUDED.provenance_json;

-- Upsert one library snapshot per organization. Existing linked artifacts keep
-- their IDs so bookmarks and callers do not break; only missing snapshots get
-- deterministic IDs.
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
), canonical AS (
  SELECT o.id organization_id, b.*,
         COALESCE(linked_artifact.artifact_id, 'template-1-' || lower(replace(b.family, '-', '')) || '-' || md5(o.id || ':' || b.source_id)) artifact_id
    FROM organizations o CROSS JOIN bases b
    LEFT JOIN v8_artifact_origin_links l
      ON l.organization_id = o.id
     AND l.origin_runtime = b.runtime
     AND l.origin_record_id = b.source_id
    LEFT JOIN v8_output_artifacts linked_artifact
      ON linked_artifact.artifact_id = l.artifact_id
     AND linked_artifact.organization_id = o.id
)
INSERT INTO v8_output_artifacts (
  artifact_id, organization_id, output_type, delivery_state,
  template_family_ref, created_by, created_at, last_transition_at,
  artifact_family, title_snapshot, canonical_home, visibility_scope,
  origin_summary_json, is_draft
)
SELECT artifact_id, organization_id, output_type, 'ready', family,
       'migration:20262271_template_base_family', CURRENT_TIMESTAMP::text,
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
  FROM canonical
ON CONFLICT (artifact_id) DO UPDATE SET
  output_type = EXCLUDED.output_type,
  delivery_state = CASE
    WHEN v8_output_artifacts.is_draft = 1 THEN v8_output_artifacts.delivery_state
    ELSE 'ready'
  END,
  template_family_ref = EXCLUDED.template_family_ref,
  last_transition_at = CASE
    WHEN (v8_output_artifacts.is_draft <> 1
          AND v8_output_artifacts.delivery_state IS DISTINCT FROM 'ready')
      OR v8_output_artifacts.template_family_ref IS DISTINCT FROM EXCLUDED.template_family_ref
      OR v8_output_artifacts.artifact_family IS DISTINCT FROM 'template'
      OR v8_output_artifacts.title_snapshot IS DISTINCT FROM EXCLUDED.title_snapshot
      OR v8_output_artifacts.canonical_home IS DISTINCT FROM 'outputs_library'
      OR v8_output_artifacts.visibility_scope IS DISTINCT FROM 'organization'
      OR v8_output_artifacts.origin_summary_json IS DISTINCT FROM EXCLUDED.origin_summary_json
      OR v8_output_artifacts.is_draft IS DISTINCT FROM
         GREATEST(v8_output_artifacts.is_draft, EXCLUDED.is_draft)
    THEN EXCLUDED.last_transition_at
    ELSE v8_output_artifacts.last_transition_at
  END,
  artifact_family = 'template',
  title_snapshot = EXCLUDED.title_snapshot,
  canonical_home = 'outputs_library',
  visibility_scope = 'organization',
  origin_summary_json = EXCLUDED.origin_summary_json,
  is_draft = GREATEST(v8_output_artifacts.is_draft, EXCLUDED.is_draft);

WITH bases AS (
  SELECT 'DOC-BASE'::text family, 'document_template'::text runtime,
         'doc-template-system-en-client_final_report'::text source_id
  UNION ALL SELECT 'DECK-BASE', 'presentation_template', 'dbr77-deck-board'
  UNION ALL SELECT 'SHEET-BASE', 'sheet_template', '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'
), canonical AS (
  SELECT o.id organization_id, b.*,
         COALESCE(linked_artifact.artifact_id, 'template-1-' || lower(replace(b.family, '-', '')) || '-' || md5(o.id || ':' || b.source_id)) artifact_id
    FROM organizations o CROSS JOIN bases b
    LEFT JOIN v8_artifact_origin_links l
      ON l.organization_id = o.id
     AND l.origin_runtime = b.runtime
     AND l.origin_record_id = b.source_id
    LEFT JOIN v8_output_artifacts linked_artifact
      ON linked_artifact.artifact_id = l.artifact_id
     AND linked_artifact.organization_id = o.id
)
INSERT INTO v8_artifact_origin_links (
  link_id, artifact_id, organization_id, origin_runtime,
  origin_record_id, is_primary_origin, created_at
)
SELECT 'template-1-link-' || md5(organization_id || ':' || runtime || ':' || source_id),
       artifact_id, organization_id, runtime, source_id, 1,
       CURRENT_TIMESTAMP::text
  FROM canonical
ON CONFLICT (organization_id, origin_runtime, origin_record_id) DO UPDATE SET
  artifact_id = EXCLUDED.artifact_id,
  is_primary_origin = 1;

SELECT count(*) INTO draft_count_after
  FROM v8_output_artifacts a
  JOIN v8_artifact_origin_links l
    ON l.artifact_id = a.artifact_id
   AND l.organization_id = a.organization_id
 WHERE a.is_draft = 1
   AND (l.origin_runtime, l.origin_record_id) IN (
     ('document_template','doc-template-system-en-client_final_report'),
     ('presentation_template','dbr77-deck-board'),
     ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
   );
IF draft_count_after <> draft_count_before THEN
  RAISE EXCEPTION 'TEMPLATE-1 readback: manual draft count changed from % to %',
    draft_count_before, draft_count_after;
END IF;
RAISE NOTICE 'TEMPLATE-1 manual drafts preserved: before %, after %',
  draft_count_before, draft_count_after;

-- Fail closed if either source or snapshot layer is incomplete, duplicated, or
-- not in the approved English system state.
  SELECT count(*) INTO org_count FROM organizations;

  IF NOT EXISTS (
    SELECT 1 FROM document_studio_templates
     WHERE template_id = 'doc-template-system-en-client_final_report'
       AND organization_id = '__system__' AND is_system AND language = 'en'
       AND status = 'approved' AND provenance_status = 'approved'
       AND jsonb_array_length(section_blueprint) = 8
       AND formatting_schema->>'family' = 'DOC-BASE'
       AND formatting_schema#>>'{themeFonts,minorLatin}' = 'Aptos'
       AND formatting_schema#>>'{fontTable,Aptos,altName}' = 'Arial'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: DOC-BASE source contract failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM presentation_templates
     WHERE id = 'dbr77-deck-board' AND organization_id IS NULL
       AND is_system AND is_active AND language_default = 'en'
       AND lifecycle_state = 'approved' AND provenance_status = 'approved'
       AND template_family = 'DECK-BASE'
       AND jsonb_array_length(outline_json::jsonb) = 8
       AND layout_policy_json::jsonb#>>'{themeFonts,minorLatin}' = 'Aptos'
       AND layout_policy_json::jsonb->>'runFonts' = 'theme-only-no-literal-font-names'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: DECK-BASE source contract failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tp_base_templates
     WHERE id = '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1'::uuid
       AND organization_id = '__system__' AND visibility = 'system'
       AND language = 'en' AND status = 'approved'
       AND provenance_status = 'approved'
       AND schema_snapshot->>'family' = 'SHEET-BASE'
       AND jsonb_array_length(schema_snapshot->'sheets') = 2
       AND schema_snapshot->>'sourceSha256' = '506d1ade58e98a31ba2d1e04c495dcddf7398ff51edffb015d11e4730e592b63'
       AND schema_snapshot#>>'{sheets,0,autoFilter}' = 'A6:K12'
       AND schema_snapshot#>>'{sheets,0,freeze,topLeftCell}' = 'C7'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: SHEET-BASE source contract failed';
  END IF;

  SELECT count(*) INTO snapshot_count
    FROM v8_artifact_origin_links l
    JOIN v8_output_artifacts a
      ON a.artifact_id = l.artifact_id
     AND a.organization_id = l.organization_id
   WHERE (l.origin_runtime, l.origin_record_id) IN (
     ('document_template','doc-template-system-en-client_final_report'),
     ('presentation_template','dbr77-deck-board'),
     ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
   )
     AND a.template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
     AND a.artifact_family = 'template';
  IF snapshot_count <> org_count * 3 THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: expected % active base snapshots, found %', org_count * 3, snapshot_count;
  END IF;

  SELECT count(*) INTO link_count
    FROM v8_artifact_origin_links
   WHERE (origin_runtime, origin_record_id) IN (
     ('document_template','doc-template-system-en-client_final_report'),
     ('presentation_template','dbr77-deck-board'),
     ('sheet_template','2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')
   );
  IF link_count <> org_count * 3 THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: expected % origin links, found %', org_count * 3, link_count;
  END IF;

  IF EXISTS (
    SELECT organization_id, template_family_ref
     FROM v8_output_artifacts
     WHERE template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
       AND is_draft = 0
     GROUP BY organization_id, template_family_ref
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: duplicate active base card';
  END IF;
END $migration$;

COMMIT;
