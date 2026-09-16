-- TEMPLATE-1 / W108 + W118: three approved, English, system template bases.
--
-- The source registries remain the generation SSOT. v8_output_artifacts is a
-- per-organization library snapshot and is updated in the same transaction.
-- This migration deliberately does not touch inventory items #93-#96. In
-- particular, the new SHEET-BASE is not a promotion of the Northwind #95 row.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.document_studio_templates') IS NULL
     OR to_regclass('public.presentation_templates') IS NULL
     OR to_regclass('public.tp_base_templates') IS NULL
     OR to_regclass('public.v8_output_artifacts') IS NULL
     OR to_regclass('public.v8_artifact_origin_links') IS NULL
     OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'TEMPLATE-1 preflight: a required template/artifact table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM document_studio_templates
     WHERE template_id = 'doc-template-system-en-client_final_report'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 preflight: canonical DOC-BASE source is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM presentation_templates WHERE id = 'dbr77-deck-board'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 preflight: canonical DECK-BASE source is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations) THEN
    RAISE EXCEPTION 'TEMPLATE-1 preflight: no organizations available for snapshots';
  END IF;
END $$;

ALTER TABLE tp_base_templates
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN tp_base_templates.language IS
  'BCP-47 language of the workbook template payload; TEMPLATE-1 system base is English.';

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
  $json${
    "family":"SHEET-BASE","contractVersion":"template-1-v1","language":"en",
    "theme":{"majorLatin":"Aptos Display","minorLatin":"Aptos","fallback":"Arial","cellFonts":"theme-only-no-literal-font-names","palette":{"navy":"1B2A41","text":"101828","blue":"2563EB","muted":"667085","line":"D8DEE8","surface":"F1F4F8","accentSoft":"DBE7FF","critical":"B42318"}},
    "tokens":{"title":"{{title}}","organizationName":"{{organization_name}}","clientLogo":"{{client_logo}}","clientLogoSource":"organizations.logo_url"},
    "sheets":[
      {"key":"scorecard","name":"Supplier Scorecard","columns":["Supplier","Category","Quality score","Delivery score","Weighted quality","Audit score","Risk score","Weighted delivery","Total weighted score","Decision","Owner"],"freeze":{"xSplit":2,"ySplit":6},"autoFilter":"A5:K5","printTitles":{"rows":"1:5"},"formulas":{"E":"=IFERROR(Cn*$B$2,0)","H":"=IFERROR(Dn*$B$3,0)","I":"=SUM(En,Hn)","J":"=IF(In>=80,\"Preferred\",IF(In>=60,\"Conditional\",\"Review\"))","totalWeighted":"=SUM(I7:In)"},"conditionalFormatting":[{"range":"I7:In","type":"colorScale"},{"range":"J7:Jn","type":"containsText"},{"range":"G7:Gn","type":"cellIs"}]},
      {"key":"field-map","name":"Field Map","columns":["Field","Source","Rule","Required","Notes"],"freeze":{"xSplit":0,"ySplit":1},"autoFilter":"A1:E1"}
    ],
    "footer":{"brand":"Consultify/DBR77","clientLogoToken":"client_logo","organizationNameToken":"organization_name"},
    "contentPolicy":"replace-data-not-layout"
  }$json$::jsonb,
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
  delivery_state = 'ready',
  template_family_ref = EXCLUDED.template_family_ref,
  last_transition_at = CASE
    WHEN v8_output_artifacts.delivery_state IS DISTINCT FROM 'ready'
      OR v8_output_artifacts.template_family_ref IS DISTINCT FROM EXCLUDED.template_family_ref
      OR v8_output_artifacts.artifact_family IS DISTINCT FROM 'template'
      OR v8_output_artifacts.title_snapshot IS DISTINCT FROM EXCLUDED.title_snapshot
      OR v8_output_artifacts.canonical_home IS DISTINCT FROM 'outputs_library'
      OR v8_output_artifacts.visibility_scope IS DISTINCT FROM 'organization'
      OR v8_output_artifacts.origin_summary_json IS DISTINCT FROM EXCLUDED.origin_summary_json
      OR v8_output_artifacts.is_draft IS DISTINCT FROM 0
    THEN EXCLUDED.last_transition_at
    ELSE v8_output_artifacts.last_transition_at
  END,
  artifact_family = 'template',
  title_snapshot = EXCLUDED.title_snapshot,
  canonical_home = 'outputs_library',
  visibility_scope = 'organization',
  origin_summary_json = EXCLUDED.origin_summary_json,
  is_draft = 0;

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

-- Fail closed if either source or snapshot layer is incomplete, duplicated, or
-- not in the approved English system state.
DO $$
DECLARE
  org_count INTEGER;
  snapshot_count INTEGER;
  link_count INTEGER;
BEGIN
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
       AND schema_snapshot#>>'{theme,minorLatin}' = 'Aptos'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: SHEET-BASE source contract failed';
  END IF;

  SELECT count(*) INTO snapshot_count
    FROM v8_output_artifacts
   WHERE template_family_ref IN ('DOC-BASE','DECK-BASE','SHEET-BASE')
     AND artifact_family = 'template' AND delivery_state = 'ready' AND is_draft = 0;
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
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'TEMPLATE-1 readback: duplicate active base card';
  END IF;
END $$;

COMMIT;
