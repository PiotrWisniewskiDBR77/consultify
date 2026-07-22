-- Seed business templates for Dokumenty / Tabele / Prezentacje module homes.
-- These are system-scope (application) template artifacts visible to all users.
-- origin_runtime uses existing 'report_template' / 'presentation_template'.
-- For sheet templates we extend the runtime check first.

-- Extend origin_runtime CHECK to allow sheet_template
ALTER TABLE v8_artifact_origin_links DROP CONSTRAINT IF EXISTS v8_artifact_origin_links_origin_runtime_check;
ALTER TABLE v8_artifact_origin_links ADD CONSTRAINT v8_artifact_origin_links_origin_runtime_check
  CHECK (
    origin_runtime IN (
      'report',
      'presentation',
      'sheet',
      'native_artifact',
      'report_template',
      'presentation_template',
      'sheet_template'
    )
  );

-- =========================================================================
-- DOCUMENT TEMPLATES (report)
-- =========================================================================

INSERT INTO v8_output_artifacts (
  artifact_id, organization_id, output_type, artifact_family,
  title_snapshot, owner_user_id, created_by, canonical_home, visibility_scope,
  origin_summary_json, created_at
) VALUES
('bt-doc-weekly', '__system__', 'report', 'template', 'Weekly Execution Report', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Sprint progress tracking with KPIs, blockers, and next steps","structureBlueprint":["Executive Summary","KPI Dashboard","Sprint Progress","Blockers & Risks","Next Steps"]}}',
 now()),

('bt-doc-steering', '__system__', 'report', 'template', 'Steering Committee Brief', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Executive summary for decision-makers with key metrics and recommendations","structureBlueprint":["Context","Key Metrics","Decisions Required","Recommendations","Timeline"]}}',
 now()),

('bt-doc-benefits', '__system__', 'report', 'template', 'Benefits Tracking Report', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"KPI realization and ROI tracking across initiatives","structureBlueprint":["Benefits Overview","KPI Tracking","ROI Analysis","Variance Analysis","Forecast"]}}',
 now()),

('bt-doc-portfolio', '__system__', 'report', 'template', 'Portfolio Overview', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Cross-initiative health dashboard with RAG status","structureBlueprint":["Portfolio Summary","Initiative Status","Resource Utilization","Risk Heat Map","Strategic Alignment"]}}',
 now()),

('bt-doc-kickoff', '__system__', 'report', 'template', 'Project Kickoff Document', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Project charter with goals, scope, team, and timeline","structureBlueprint":["Project Overview","Goals & Objectives","Scope","Team & Roles","Timeline & Milestones","Risks"]}}',
 now()),

('bt-doc-risk', '__system__', 'report', 'template', 'Risk Assessment Report', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Comprehensive risk identification and mitigation planning","structureBlueprint":["Risk Summary","Risk Register","Impact Analysis","Mitigation Strategies","Monitoring Plan"]}}',
 now()),

('bt-doc-dd', '__system__', 'report', 'template', 'Due Diligence Report', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Investment analysis covering financials, operations, and market position","structureBlueprint":["Executive Summary","Financial Analysis","Operations Review","Market Position","Legal & Compliance","Recommendation"]}}',
 now()),

('bt-doc-market', '__system__', 'report', 'template', 'Market Analysis Report', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Market sizing, competitive landscape, and trend analysis","structureBlueprint":["Market Overview","Market Sizing","Competitive Landscape","Trend Analysis","Opportunities & Threats","Recommendations"]}}',
 now());

-- Origin links for document templates
INSERT INTO v8_artifact_origin_links (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin)
VALUES
('ol-bt-doc-weekly', 'bt-doc-weekly', '__system__', 'report_template', 'bt-doc-weekly', 1),
('ol-bt-doc-steering', 'bt-doc-steering', '__system__', 'report_template', 'bt-doc-steering', 1),
('ol-bt-doc-benefits', 'bt-doc-benefits', '__system__', 'report_template', 'bt-doc-benefits', 1),
('ol-bt-doc-portfolio', 'bt-doc-portfolio', '__system__', 'report_template', 'bt-doc-portfolio', 1),
('ol-bt-doc-kickoff', 'bt-doc-kickoff', '__system__', 'report_template', 'bt-doc-kickoff', 1),
('ol-bt-doc-risk', 'bt-doc-risk', '__system__', 'report_template', 'bt-doc-risk', 1),
('ol-bt-doc-dd', 'bt-doc-dd', '__system__', 'report_template', 'bt-doc-dd', 1),
('ol-bt-doc-market', 'bt-doc-market', '__system__', 'report_template', 'bt-doc-market', 1);

-- =========================================================================
-- SHEET TEMPLATES (sheet)
-- =========================================================================

INSERT INTO v8_output_artifacts (
  artifact_id, organization_id, output_type, artifact_family,
  title_snapshot, owner_user_id, created_by, canonical_home, visibility_scope,
  origin_summary_json, created_at
) VALUES
('bt-sheet-finmodel', '__system__', 'sheet', 'template', 'Financial Model', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"P&L + Balance Sheet + Cash Flow projections with linked formulas","structureBlueprint":["Assumptions","P&L","Balance Sheet","Cash Flow","Sensitivity Analysis"]}}',
 now()),

('bt-sheet-budget', '__system__', 'sheet', 'template', 'Budget Planning', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Annual/quarterly budget template with variance tracking","structureBlueprint":["Budget Summary","Revenue","OpEx","CapEx","Variance Analysis"]}}',
 now()),

('bt-sheet-resource', '__system__', 'sheet', 'template', 'Resource Allocation Matrix', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Team capacity and project assignment tracker","structureBlueprint":["Team Overview","Allocation Grid","Utilization Metrics","Gap Analysis"]}}',
 now()),

('bt-sheet-risk', '__system__', 'sheet', 'template', 'Risk Register', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Risk log with probability, impact scoring, and ownership","structureBlueprint":["Risk Log","Scoring Matrix","Mitigation Actions","Status Tracking"]}}',
 now()),

('bt-sheet-timeline', '__system__', 'sheet', 'template', 'Project Timeline', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Gantt-style milestone tracker with dependencies","structureBlueprint":["Milestones","Tasks","Dependencies","Resources","Timeline View"]}}',
 now()),

('bt-sheet-competitive', '__system__', 'sheet', 'template', 'Competitive Analysis Matrix', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Feature comparison grid across competitors","structureBlueprint":["Competitor Overview","Feature Comparison","Pricing","Strengths & Weaknesses","Summary"]}}',
 now()),

('bt-sheet-recruit', '__system__', 'sheet', 'template', 'Recruitment Pipeline', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Candidate tracking with stages and evaluation criteria","structureBlueprint":["Open Positions","Pipeline","Evaluations","Offers","Analytics"]}}',
 now()),

('bt-sheet-okr', '__system__', 'sheet', 'template', 'OKR Tracking Sheet', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Objectives, key results, and quarterly progress tracking","structureBlueprint":["Objectives","Key Results","Progress Tracking","Scoring","Review Notes"]}}',
 now());

-- Origin links for sheet templates
INSERT INTO v8_artifact_origin_links (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin)
VALUES
('ol-bt-sheet-finmodel', 'bt-sheet-finmodel', '__system__', 'sheet_template', 'bt-sheet-finmodel', 1),
('ol-bt-sheet-budget', 'bt-sheet-budget', '__system__', 'sheet_template', 'bt-sheet-budget', 1),
('ol-bt-sheet-resource', 'bt-sheet-resource', '__system__', 'sheet_template', 'bt-sheet-resource', 1),
('ol-bt-sheet-risk', 'bt-sheet-risk', '__system__', 'sheet_template', 'bt-sheet-risk', 1),
('ol-bt-sheet-timeline', 'bt-sheet-timeline', '__system__', 'sheet_template', 'bt-sheet-timeline', 1),
('ol-bt-sheet-competitive', 'bt-sheet-competitive', '__system__', 'sheet_template', 'bt-sheet-competitive', 1),
('ol-bt-sheet-recruit', 'bt-sheet-recruit', '__system__', 'sheet_template', 'bt-sheet-recruit', 1),
('ol-bt-sheet-okr', 'bt-sheet-okr', '__system__', 'sheet_template', 'bt-sheet-okr', 1);

-- =========================================================================
-- PRESENTATION TEMPLATES (presentation)
-- =========================================================================

INSERT INTO v8_output_artifacts (
  artifact_id, organization_id, output_type, artifact_family,
  title_snapshot, owner_user_id, created_by, canonical_home, visibility_scope,
  origin_summary_json, created_at
) VALUES
('bt-deck-steering', '__system__', 'presentation', 'template', 'Steering Committee Deck', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Board-level status presentation with key metrics and decisions","structureBlueprint":["Cover","Agenda","Executive Summary","Status Overview","Key Metrics","Decisions Required","Next Steps"]}}',
 now()),

('bt-deck-status', '__system__', 'presentation', 'template', 'Project Status Update', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Weekly/monthly progress slides with RAG indicators","structureBlueprint":["Cover","Summary","Progress by Workstream","Milestones","Risks & Issues","Next Period Plan"]}}',
 now()),

('bt-deck-pitch', '__system__', 'presentation', 'template', 'Pitch Deck', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Investor / stakeholder pitch with problem, solution, and traction","structureBlueprint":["Cover","Problem","Solution","Market Size","Business Model","Traction","Team","Ask"]}}',
 now()),

('bt-deck-workshop', '__system__', 'presentation', 'template', 'Workshop Facilitation Deck', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Interactive exercises, agenda, and facilitation guides","structureBlueprint":["Cover","Agenda","Icebreaker","Exercise 1","Break","Exercise 2","Debrief","Action Items"]}}',
 now()),

('bt-deck-qbr', '__system__', 'presentation', 'template', 'Quarterly Business Review', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"QBR metrics, achievements, and roadmap outlook","structureBlueprint":["Cover","Quarter Highlights","Revenue & Growth","Customer Metrics","Product Roadmap","Goals Next Quarter"]}}',
 now()),

('bt-deck-strategy', '__system__', 'presentation', 'template', 'Strategy Roadmap', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Vision, strategic goals, milestones, and execution plan","structureBlueprint":["Cover","Vision","Strategic Pillars","Roadmap Timeline","Resource Needs","Success Metrics"]}}',
 now()),

('bt-deck-invest', '__system__', 'presentation', 'template', 'Investment Case Deck', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"NPV/IRR/ROI analysis for investment decision support","structureBlueprint":["Cover","Investment Thesis","Financial Projections","NPV & IRR Analysis","Risk Assessment","Recommendation"]}}',
 now()),

('bt-deck-digital', '__system__', 'presentation', 'template', 'Digital Transformation Assessment', '__system__', '__system__', 'outputs_library', 'organization',
 '{"template":{"scope":"application","status":"active","description":"Maturity assessment, gaps analysis, and transformation recommendations","structureBlueprint":["Cover","Current State","Maturity Assessment","Gap Analysis","Recommendations","Implementation Roadmap","Expected Impact"]}}',
 now());

-- Origin links for presentation templates
INSERT INTO v8_artifact_origin_links (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin)
VALUES
('ol-bt-deck-steering', 'bt-deck-steering', '__system__', 'presentation_template', 'bt-deck-steering', 1),
('ol-bt-deck-status', 'bt-deck-status', '__system__', 'presentation_template', 'bt-deck-status', 1),
('ol-bt-deck-pitch', 'bt-deck-pitch', '__system__', 'presentation_template', 'bt-deck-pitch', 1),
('ol-bt-deck-workshop', 'bt-deck-workshop', '__system__', 'presentation_template', 'bt-deck-workshop', 1),
('ol-bt-deck-qbr', 'bt-deck-qbr', '__system__', 'presentation_template', 'bt-deck-qbr', 1),
('ol-bt-deck-strategy', 'bt-deck-strategy', '__system__', 'presentation_template', 'bt-deck-strategy', 1),
('ol-bt-deck-invest', 'bt-deck-invest', '__system__', 'presentation_template', 'bt-deck-invest', 1),
('ol-bt-deck-digital', 'bt-deck-digital', '__system__', 'presentation_template', 'bt-deck-digital', 1);
