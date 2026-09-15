-- DEC-461 / F8b (2026-09-15) — Template Library: English first.
--
-- MEASURED, not assumed. The Materials → Template Library screenshot
-- (cto-codex/final-targi-20260915/zrzuty/47-materials-templates-fin) showed 22
-- Polish cards inside the "Application" bucket (90 of 96). Grepping the repo
-- for those exact strings found only 6 of them in code
-- (deliverableTemplateSeedService.ts, fixed EN-first in the same commit) — the
-- remaining 16 exist ONLY as database rows, seeded historically and not
-- reproducible from any file in the tree. So the screen cannot be fixed in
-- TypeScript alone: this migration is the fix for the rows themselves.
--
-- Two-layer write, because the Library read path uses a SNAPSHOT:
--   1. the source registries (report_builder_templates, presentation_templates,
--      document_studio_templates, tp_base_templates) — so a re-backfill does
--      not reintroduce Polish;
--   2. v8_output_artifacts.title_snapshot + origin_summary_json.template
--      .description — what the card actually renders. artifactRegistryService
--      .enrichTemplateOriginSummaries() refreshes only scope/status/orphan, never
--      the title or the description, so updating (1) alone would change nothing
--      on screen.
--
-- Also removes internal jargon from two descriptions that leaked engineering
-- vocabulary to clients ("wskaźniki Z111 (financeRatioFamilyCatalog, 24/5
-- rodzin) + reconcile R1-R8 (shadow) ... Kontrakt F5 (_KONCEPT_RDZEN §4)") and
-- replaces each with one sentence saying what the template gives the reader.
--
-- Filename: date-prefixed on purpose. The runtime runner
-- (DatabaseInitializer.runTablePlatformMigrations) only discovers files matching
-- MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/ — a 9xx name would silently
-- never run at startup (see services/tablePlatform/migrationIdentity.ts). The
-- whole file executes inside ONE transaction (BEGIN; db.query(sql); COMMIT), so
-- the ON COMMIT DROP temp table is valid.
--
-- Idempotent: every statement matches on the Polish text, so a second run
-- matches nothing. Additive — no row is inserted or deleted, nothing is
-- dropped, so there is no rollback step (re-running is a no-op).
--
-- NOT touched: the paired '[System] ... (EN)' / '[System] ... (PL)' templates.
-- Those are a deliberate language pair — the Polish one is the Polish-output
-- template and its name carries the (PL) marker. Renaming them would delete a
-- feature, not fix a defect.

CREATE TEMP TABLE tmp_tpl_en_first (
  pl_name TEXT PRIMARY KEY,
  en_name TEXT NOT NULL,
  en_description TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_tpl_en_first (pl_name, en_name, en_description) VALUES
  ('PMO Weekly', 'PMO Weekly',
   'Weekly PMO operations report: on-time versus late tasks, team capacity and overload, and cycle time per initiative status.'),
  ('Raport Steering', 'Steering Report',
   'Fuller steering-committee view: the three axes per initiative, open risks, and scope changes from the last 30 days.'),
  ('Sponsor One-Pager', 'Sponsor One-Pager',
   'One page for the sponsor: the three axes combined (time, tasks and value, with value split into financial and operational KPI), the top three alerts (overdue or blocked) and decisions awaiting approval.'),
  ('Cotygodniowy status PMO (PMO Weekly Status)', 'PMO Weekly Status',
   'Recurring team and PMO operations report: summary, delivered, in progress, blockers and next week''s plan. For the weekly sync and the decision trail.'),
  ('Streszczenie wykonawcze (Executive Summary)', 'Executive Summary',
   'A standalone summary in the pyramid structure: the main conclusion first, then supporting arguments, evidence, implications and a recommendation. Opens any larger report.'),
  ('Uzasadnienie biznesowe (Business Case)', 'Business Case',
   'Investment decision document: the problem, the options considered, cost-benefit analysis (NPV and ROI), risks and a recommendation. The standard for initiative funding gates.'),
  ('Raport diagnostyczny DRD (Diagnostic Report)', 'Diagnostic Report (DRD)',
   'Structured diagnostic report in the DRD layout: context, method, findings, gap analysis, recommendations and roadmap. From facts, through conclusions, to a plan of action.'),
  ('Aktualizacja dla komitetu sterującego (Steering Committee Update)', 'Steering Committee Update',
   'Full steering-committee brief: executive summary, RAG status by dimension, milestones and forecast, risks and the decisions required. The PMBOK/PRINCE2 standard for management reviews.'),
  ('Jednostronicowy raport dla sponsora (Sponsor One-Pager)', 'Sponsor One-Page Status',
   'A concise one-page status for the project sponsor: RAG, progress against plan, decisions and escalations. Use it between steering committees, when the sponsor needs a fast picture and a clear ask.'),
  ('Deck raportu końcowego (Final Report Deck)', 'Final Report Deck',
   'Project closure presentation: goals versus results achieved, key lessons, forward recommendations and how the benefits are sustained. Closes the narrative and hands over the value.'),
  ('Przegląd komitetu sterującego (Steering Review)', 'Steering Review Deck',
   'Steering-committee deck: RAG and KPI status, milestones and forecast, risks and the decisions required. The management format for a portfolio or project review.'),
  ('Deck rekomendacji Minto (Recommendation Deck)', 'Recommendation Deck',
   'Recommendation presentation in the pyramid structure: the recommendation first, then supporting arguments, evidence, the options considered, the implementation plan and the decision. Built to convince decision-makers.'),
  ('Prezentacja ustaleń SCR (Findings Readout)', 'Findings Readout',
   'Findings readout in the Situation-Complication-Resolution structure: situation, complication, key findings, implications, recommendation. The classic format for presenting a diagnosis.'),
  ('Deck otwarcia projektu (Kickoff Deck)', 'Kickoff Deck',
   'Project kickoff presentation: goal, scope, team, plan and ways of working. Sets a shared understanding and a mandate at the start.'),
  ('Finance — Sekcja finansowa raportu', 'Finance — report financial section',
   'The financial section of a report: ratio families, reconciled figures and the valuation range, computed deterministically from your data — no number in it comes from a language model.'),
  ('Program — Raport 3 osi (czas × zadania × wartość)', 'Program — three-axis report (time, tasks, value)',
   'The flagship delivery report: schedule against plan, task and budget progress, and value banked against target — the whole programme on one page.'),
  ('Raport statusowy', 'Status Report',
   'Periodic project progress report for the sponsor. Sections: status summary, scope, progress, risks, next steps.'),
  ('Raport audytowy', 'Audit Report',
   'Structured report from an organizational or process audit. Sections: summary, methodology, findings, recommendations.'),
  ('Investor pitch', 'Investor pitch',
   'Investor pitch: problem to solution to traction to ask. Layout: cover, thesis, problem and market, solution, model and traction, plan, ask.'),
  ('Executive memo', 'Executive memo',
   'A concise decision memo for the board. Sections: context, problem, options, recommendation.'),
  ('Board deck', 'Board deck',
   'Presentation for the board or supervisory board. Layout: cover, agenda, context, results, plan, Q&A.'),
  ('Diagnostic deck', 'Diagnostic deck',
   'Diagnosis of an organization or a process. Layout: thesis, data, analysis, conclusions, recommendations.'),
  ('Rejestr ryzyk', 'Risk Register',
   'Table for tracking project or organizational risks. Columns: risk, likelihood, impact, owner, status.'),
  ('Dashboard KPI', 'KPI Dashboard',
   'KPI table with targets and current results. Columns: metric, target, actual, variance, trend.'),
  ('Rejestr inicjatyw', 'Initiative Register',
   'Table for tracking initiatives and tasks with priority and progress. Columns: initiative, owner, priority, status, progress.');

-- 1. Source registries (system/global rows only — never an org's own template).
UPDATE report_builder_templates t
   SET name = m.en_name, description = m.en_description, updated_at = NOW()
  FROM tmp_tpl_en_first m
 WHERE t.name = m.pl_name
   AND (t.organization_id IS NULL OR t.organization_id IN ('__system__', '__global__'));

UPDATE presentation_templates t
   SET name = m.en_name, description = m.en_description, updated_at = NOW()
  FROM tmp_tpl_en_first m
 WHERE t.name = m.pl_name
   AND (t.organization_id IS NULL OR t.organization_id IN ('__system__', '__global__'));

UPDATE document_studio_templates t
   SET name = m.en_name, purpose = m.en_description, language = 'en'
  FROM tmp_tpl_en_first m
 WHERE t.name = m.pl_name
   AND t.organization_id IN ('__system__', '__global__');

UPDATE tp_base_templates t
   SET name = m.en_name, description = m.en_description
  FROM tmp_tpl_en_first m
 WHERE t.name = m.pl_name
   AND t.created_by IS NULL;

-- 2. What the Library card actually renders: the artifact snapshot.
UPDATE v8_output_artifacts a
   SET title_snapshot = m.en_name
  FROM tmp_tpl_en_first m
 WHERE a.artifact_family = 'template'
   AND a.title_snapshot = m.pl_name;

UPDATE v8_output_artifacts a
   SET origin_summary_json = jsonb_set(
         a.origin_summary_json::jsonb,
         '{template,description}',
         to_jsonb(m.en_description),
         true
       )::text
  FROM tmp_tpl_en_first m
 WHERE a.artifact_family = 'template'
   AND a.title_snapshot = m.en_name
   AND a.origin_summary_json IS NOT NULL
   AND a.origin_summary_json LIKE '{%'
   AND jsonb_typeof(a.origin_summary_json::jsonb -> 'template') = 'object'
   -- Convergent AND a strict no-op on re-run: skip rows already carrying the
   -- English description (the title match above is on en_name, which survives
   -- the first run).
   AND COALESCE(a.origin_summary_json::jsonb #>> '{template,description}', '') <> m.en_description;
