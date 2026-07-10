-- Migration 910: `report_definitions` — centralny rejestr definicji raportów pod kanonem F5
--
-- KONTEKST (F5 — rdzeń 2026-07-10, §4.2): silnik raportów ma JEDEN kanon runtime =
-- `reportBuilderService` (mount Gateway `/api/report-builder`, wersjonowanie
-- `report_builder_versions`). Do tej pory NIE istniał trwały rejestr DEFINICJI raportów —
-- katalog Execution był HARDKODEM po stronie klienta (`ExecutionHub.tsx` `reportCatalog`,
-- 11 statycznych pozycji), a martwy `reportRegistry.ts` był jego nieużywanym bliźniakiem.
-- Ta tabela jest tym rejestrem: „jakie raporty istnieją i jak się je czyta" żyje w bazie,
-- nie w komponencie React. Kanon F5 czyta definicje stąd; front renderuje to, co dostanie.
--
-- MODEL 4 TRYBÓW (rdzeń §4.2, reguła „live=patrzeć, snapshot=publikować"):
--   read_mode='live'      → dashboard/podgląd, render zawsze świeży, bez artefaktu (tryb 2)
--   read_mode='snapshot'  → publikacja/grounding, przez createSnapshot→wersja immutable (tryb 1)
-- Eksport pliku (tryb 3) i template strukturalny (tryb 4) idą przez `reportContract.ts`.
--
-- KOLUMNY (spójne z zadaniem F5 + SSOT §4.2):
--   id             TEXT   — stabilny klucz definicji ('weekly-exec' dla systemowych; uuid dla org-custom)
--   organization_id UUID  — NULL = definicja SYSTEMOWA (widoczna dla wszystkich org)
--   key            TEXT   — klucz maszynowy (= id dla systemowych; pod przyszłe org-namespacing)
--   name           TEXT   — tytuł prezentowany
--   kind           TEXT   — dyskryminant katalogu ('EXECUTION_PACK' dla pierwszej fali)
--   audience       TEXT   — odbiorca (z hardkodu)
--   cadence        TEXT   — kadencja (Weekly/Monthly/Bi-weekly/On demand)
--   scope          TEXT   — zakres opisowy
--   read_mode      TEXT   — 'live' | 'snapshot' (§4.2); Execution catalog = 'live' (tryb 2)
--   sections_json  JSONB  — lista sekcji raportu (section_specs)
--   source_binding JSONB  — wiązanie do danych + prezentacja: { dataSources[], ragLogic,
--                            followUpActions[], icon:{name,className}, highlights[] }
--                            (highlights: [{label, metric, variant?}] — front rehydruje z live-state)
--   template_ref   TEXT   — tryb 4 structural-template (na razie NULL)
--   is_system      BOOLEAN— true = seed systemowy (niemodyfikowalny przez usera)
--   created_at     TIMESTAMPTZ
--
-- Idempotentna + fail-soft: CREATE TABLE IF NOT EXISTS, seed przez ON CONFLICT DO NOTHING.
-- Bezpieczna do wielokrotnego uruchomienia. Na SQLite (dev) JSONB→TEXT, `parseMaybeJson`
-- normalizuje na odczycie (wzorzec migracji 902/903). MIGRACJI NIE URUCHAMIAMY tutaj —
-- to artefakt do przeglądu.

CREATE TABLE IF NOT EXISTS report_definitions (
  id              TEXT PRIMARY KEY,
  organization_id UUID,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,
  audience        TEXT,
  cadence         TEXT,
  scope           TEXT,
  read_mode       TEXT NOT NULL DEFAULT 'live',
  sections_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_binding  JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_ref    TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rejestr czytany per organizacja: systemowe (organization_id IS NULL) + org-własne.
CREATE INDEX IF NOT EXISTS idx_report_definitions_org  ON report_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_definitions_kind ON report_definitions(kind);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: 11 definicji Execution przeniesionych DOSŁOWNIE z hardkodu
-- `src/components/Execution/ExecutionHub.tsx` (`reportCatalog` base[]).
-- Dane transferowane 1:1 (nie wymyślane). read_mode='live' — katalog Execution renderuje
-- się na żywo z reportDataContext (tryb 2). Pozycje kreatora (wizardEntries) NIE są seedami —
-- to runtime-generowane instancje, zostają poza rejestrem definicji.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO report_definitions
  (id, organization_id, key, name, kind, audience, cadence, scope, read_mode, sections_json, source_binding, is_system)
VALUES
  ('weekly-exec', NULL, 'weekly-exec', 'Weekly Execution Pack', 'EXECUTION_PACK',
   'PMO, Team Leads', 'Weekly', 'All active initiatives in current execution cycle', 'live',
   '["Progress summary","Blockers & escalations","Overdue items","Next milestones","Key decisions needed"]'::jsonb,
   '{"dataSources":["Initiatives","Tasks","Decisions","Risk signals","Milestones"],"ragLogic":"GREEN if no blockers and progress on-track; AMBER if overdue items >0 or progress <5% this week; RED if blockers >0","followUpActions":["Clear blockers","Resolve overdue decisions","Update missing dates","Reassign stale tasks"],"icon":{"name":"CalendarDays","className":"text-blue-500"},"highlights":[{"label":"Progress","metric":"progress"},{"label":"Blocked","metric":"blocked","variant":"critIfPos"},{"label":"Tasks","metric":"tasks"}]}'::jsonb,
   TRUE),

  ('monthly-pmo', NULL, 'monthly-pmo', 'Monthly PMO Review', 'EXECUTION_PACK',
   'PMO Director, Sponsors', 'Monthly', 'Full portfolio month-over-month trends', 'live',
   '["Portfolio trend (MoM)","Milestone slippage summary","Budget variance","Delivery confidence","Capacity utilization overview"]'::jsonb,
   '{"dataSources":["Initiatives","Budget","Milestones","Baseline/forecast","Capacity"],"ragLogic":"GREEN if all initiatives on-track; AMBER if >20% initiatives amber; RED if any initiative RED or budget variance >15%","followUpActions":["Rebaseline slipped initiatives","Escalate budget overruns","Rebalance overloaded resources"],"icon":{"name":"TrendingUp","className":"text-indigo-500"},"highlights":[{"label":"Initiatives","metric":"initiatives"},{"label":"Missing dates","metric":"missingDates","variant":"warnIfPos"}]}'::jsonb,
   TRUE),

  ('program-health', NULL, 'program-health', 'Program Health Summary', 'EXECUTION_PACK',
   'Steering Committee', 'Bi-weekly', 'Per-initiative RAG and aggregate program health', 'live',
   '["RAG per initiative","Priority alerts","Confidence score & trend","Executive narrative","Required governance decisions"]'::jsonb,
   '{"dataSources":["Initiatives","Risk signals","Delay signals","Priority alerts","Exec snapshot"],"ragLogic":"GREEN if confidence >70% and no critical alerts; AMBER if confidence 40-70% or critical alerts exist; RED if confidence <40% or multiple critical blockers","followUpActions":["Review RED initiatives","Approve recovery plans","Authorize resource reallocation"],"icon":{"name":"Shield","className":"text-emerald-500"},"highlights":[{"label":"Blocked","metric":"blocked","variant":"critIfPos"},{"label":"Progress","metric":"progress"}]}'::jsonb,
   TRUE),

  ('blockers-recovery', NULL, 'blockers-recovery', 'Blockers & Recovery Report', 'EXECUTION_PACK',
   'PMO, Delivery Managers', 'On demand', 'All blocked initiatives and downstream blast radius', 'live',
   '["Active blockers list","Blast radius per blocker","Owner accountability","Recovery actions proposed","Dependency chain impact"]'::jsonb,
   '{"dataSources":["Blocked initiatives","Dependencies","Tasks","Risk register"],"ragLogic":"RED if any blockers; AMBER if blockers existed in last 7 days; GREEN if clear for >7 days","followUpActions":["Assign blocker owners","Remove external dependencies","Escalate to governance","Replan affected work"],"icon":{"name":"AlertTriangle","className":"text-danger-500"},"highlights":[{"label":"Blocked","metric":"blocked","variant":"critIfPos"},{"label":"Due soon","metric":"dueSoon"}]}'::jsonb,
   TRUE),

  ('milestone-slippage', NULL, 'milestone-slippage', 'Milestone Slippage Report', 'EXECUTION_PACK',
   'PMO, Sponsors', 'Weekly', 'All milestones with baseline vs forecast drift', 'live',
   '["Slipped milestones","Drift by initiative","Root cause analysis","Forecast accuracy trend","Recovery timeline"]'::jsonb,
   '{"dataSources":["Milestones","Baseline","Forecast","Delay signals"],"ragLogic":"GREEN if no milestones slipped >3 days; AMBER if 1-2 milestones slipped; RED if >2 milestones slipped or any critical milestone missed","followUpActions":["Rebaseline slipped milestones","Add recovery buffer","Escalate critical misses"],"icon":{"name":"Clock","className":"text-amber-500"},"highlights":[{"label":"Missing dates","metric":"missingDates","variant":"warnIfPos"}]}'::jsonb,
   TRUE),

  ('capacity-utilization', NULL, 'capacity-utilization', 'Capacity Utilization Report', 'EXECUTION_PACK',
   'Resource Managers, PMO', 'Monthly', 'Per-person and per-team workload vs capacity', 'live',
   '["Utilization by person","Team averages","Overload alerts","Underutilized resources","Capacity horizon (4-week lookahead)"]'::jsonb,
   '{"dataSources":["Tasks","Assignments","Capacity","Workload view"],"ragLogic":"GREEN if all <85% utilized; AMBER if anyone 85-100%; RED if anyone >100% or team average >90%","followUpActions":["Smooth overloaded assignments","Redistribute idle capacity","Flag resource gaps to hiring"],"icon":{"name":"Users","className":"text-c-text-muted"},"highlights":[{"label":"Tasks","metric":"tasks"}]}'::jsonb,
   TRUE),

  ('budget-variance', NULL, 'budget-variance', 'Budget Variance Report', 'EXECUTION_PACK',
   'Finance, Sponsors', 'Monthly', 'Planned vs actual budget per initiative', 'live',
   '["Aggregate budget status","Per-initiative variance","Forecast overshoot alerts","Burn rate trend","Cost category breakdown"]'::jsonb,
   '{"dataSources":["Budget","Initiatives","Overspend signals"],"ragLogic":"GREEN if variance <5%; AMBER if 5-15%; RED if >15% overspend or forecast exceeds approved budget","followUpActions":["Review overspending initiatives","Request budget reallocation","Freeze discretionary spend"],"icon":{"name":"TrendingUp","className":"text-green-500"},"highlights":[{"label":"Initiatives","metric":"initiatives"}]}'::jsonb,
   TRUE),

  ('decision-backlog', NULL, 'decision-backlog', 'Decision Backlog & Approval Aging', 'EXECUTION_PACK',
   'PMO, Decision Owners', 'Weekly', 'All pending decisions and approval age', 'live',
   '["Pending decisions list","Aging histogram","Decision-latency risk","Accountability gaps","Downstream blocked work"]'::jsonb,
   '{"dataSources":["Decisions","Action queue","Initiative dependencies"],"ragLogic":"GREEN if no decisions overdue; AMBER if 1-3 overdue; RED if >3 overdue or any blocking critical path","followUpActions":["Escalate aged decisions","Assign decision owners","Unblock dependent work"],"icon":{"name":"Scale","className":"text-amber-600"},"highlights":[{"label":"Overdue","metric":"overdueDecisions","variant":"warnIfPos"},{"label":"Pending","metric":"pendingDecisions"}]}'::jsonb,
   TRUE),

  ('cross-dependency', NULL, 'cross-dependency', 'Cross-Initiative Dependency Report', 'EXECUTION_PACK',
   'PMO, Architects', 'Bi-weekly', 'Inter-initiative dependency graph and cascade risk', 'live',
   '["Dependency map","Critical path","Cascade impact analysis","Dependency health","External dependency risks"]'::jsonb,
   '{"dataSources":["Dependencies","Initiatives","Risk signals"],"ragLogic":"GREEN if no dependency conflicts; AMBER if dependencies at risk; RED if broken dependency chain on critical path","followUpActions":["Resolve dependency conflicts","Decouple tightly coupled work","Add buffers to critical chains"],"icon":{"name":"GripVertical","className":"text-c-text-muted"},"highlights":[{"label":"Initiatives","metric":"initiatives"}]}'::jsonb,
   TRUE),

  ('delivery-confidence', NULL, 'delivery-confidence', 'Delivery Confidence Report', 'EXECUTION_PACK',
   'Steering Committee, Sponsors', 'Monthly', 'Risk-adjusted delivery forecast with confidence scoring', 'live',
   '["Confidence per initiative","Trend direction","Risk-adjusted forecast","Sponsor-ready narrative","Recommended governance actions"]'::jsonb,
   '{"dataSources":["Initiatives","Risk signals","Delay signals","Budget","Exec snapshot"],"ragLogic":"GREEN if aggregate confidence >75%; AMBER if 50-75%; RED if <50% or confidence declining for 2+ periods","followUpActions":["Investigate declining confidence","Approve recovery plans","Communicate revised timelines"],"icon":{"name":"Sparkles","className":"text-blue-500"},"highlights":[{"label":"Progress","metric":"progress"},{"label":"Blocked","metric":"blocked","variant":"critIfPos"}]}'::jsonb,
   TRUE),

  ('sponsor-onepager', NULL, 'sponsor-onepager', 'Sponsor-Ready One-Pager', 'EXECUTION_PACK',
   'Executive Sponsors', 'On demand', 'Concise executive summary of portfolio state', 'live',
   '["Overall progress","Top 3 risks","Next milestones","Decisions required from sponsor","Key achievements this period"]'::jsonb,
   '{"dataSources":["Exec snapshot","Initiatives","Risk signals","Milestones"],"ragLogic":"Mirrors program health RAG: composite of progress, blockers and confidence","followUpActions":["Make requested decisions","Remove escalated blockers","Approve budget changes"],"icon":{"name":"FileText","className":"text-indigo-500"},"highlights":[{"label":"Progress","metric":"progress"}]}'::jsonb,
   TRUE)
ON CONFLICT (id) DO NOTHING;
