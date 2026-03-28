# AGENT 2 - Execution Plan

> Status: supporting source, not canonical plan
> Manager note: use as source for Agent 4 only
> Authority file: `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`

## 1. Scope
- `Inicjatywy / Projekty`
- `Wdrozenia / Execution`
- `KPI / BI / Results`
- `Finanse`

## 2. Source of truth reviewed
- Reviewed authority docs:
  - `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`
  - `docs/product/work-packets/Plan V8.1 Final.md`
  - `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Reviewed module docs:
  - `docs/product/PROJECT_MANAGEMENT_V8_MASTER_SUMMARY.md`
  - `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`
  - `docs/product/EXECUTION_READINESS_AUDIT_V8.md`
  - `docs/product/EXECUTION_MANAGEMENT_BENCHMARK_V8.md`
  - `docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
  - `docs/product/RESULTS_V8_SSOT.md`
  - `docs/product/FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
  - `docs/product/FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`
- Reviewed frontend surfaces:
  - `src/components/Initiatives/InitiativesHub.tsx`
  - `src/components/Execution/ExecutionHub.tsx`
  - `src/components/Results/ResultsHub.tsx`
  - `src/components/Economics/FinanceHub.tsx`
  - `src/views/FullExecutionView.tsx`
  - `src/views/EconomicsView.tsx`
  - `src/views/KpiOkrView.tsx`
  - `src/routes/AppRoutes.tsx`
- Reviewed backend/runtime paths:
  - `server/src/routes/v8/planning.routes.ts`
  - `server/src/routes/v8/execution-control.routes.ts`
  - `server/src/routes/v8/results.routes.ts`
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/services/v8/planningContinuityService.ts`
  - `server/src/services/v8/executionVisibilityService.ts`
  - `server/src/services/v8/resultsROIService.ts`
  - `server/src/services/v8/financeIntegrationService.ts`
  - `server/src/routes/v8/__tests__/planning.routes.test.ts`
  - `server/src/routes/v8/__tests__/execution-control.routes.test.ts`
  - `server/src/routes/v8/__tests__/results.routes.test.ts`
  - `server/src/routes/v8/__tests__/finance.routes.test.ts`
- Benchmarks used:
  - `Asana`
  - `monday.com`
  - `Microsoft Power BI`
  - `Pigment`

## 3. Executive summary
This plan assumes `Agent 2` owns the most runtime-heavy 4-module spine: `Inicjatywy`, `Execution`, `KPI / Results`, and `Finanse`. That assumption is the most coherent reading of the unresolved placeholders in the prompt and the historical role of `Agent 2` as the runtime-closure owner. The repo already contains real product surfaces and real V8 routes for all four modules, so this is not a blank-slate area. The strongest existing truth is under the hood: planning continuity, execution signals, results KPI/ROI contracts, and finance ingestion/modeling all exist as serious backend/runtime seams with dedicated tests. The weakest layer is not missing code in general; it is product coherence across write paths, routing, naming, fallback behavior, and user-facing flow completion.

`Inicjatywy` is the best candidate for becoming the control anchor of this group, but today it still mixes governed V8 reads with legacy write/update flows. `Execution` is already meaningful and can be used, yet it still behaves more like a stitched operator surface than a fully governed control tower because parts of its health, tasks, decisions, and mutations still rely on legacy seams. `Results` is stronger than it looks because it has real V8 write continuity for KPI and ROI, but its product surface is still semantically confusing because the main route is effectively `Benefits`, legacy naming survives, and scorecard/executive-review breadth is weaker than the core KPI loop. `Finanse` is the broadest and deepest runtime package in this scope, but also the easiest place to overestimate readiness: the backend is broad, while the user-facing operating model is still more analyst-workbench than full CFO operating system.

The biggest risk across the whole scope is split-brain: V8-first contracts exist, but too many critical flows still allow legacy fallback or legacy naming to define the real user experience. The fastest high-value improvement is not a new architecture. It is a bounded sequence that makes `Inicjatywy -> Execution -> Results -> Finanse` feel like one governed operating spine with no ambiguous write path on the main happy flow. The second major risk is documentation authority drift: `Plan v8.pdf` and the original `Softs` tree are cited as primary sources in current docs, but were not present in this repo snapshot, so parts of the original vision must be reconstructed from the V8 benchmark/readiness layer rather than the literal parent artifacts.

## 4. Module-by-module analysis

### Inicjatywy / Projekty

#### 4.1 Intended product behavior
- The intended product is not a static initiative registry.
- According to `PROJECT_MANAGEMENT_V8_MASTER_SUMMARY.md`, the canonical path is `entrypoint -> source materialization -> initiative draft -> planning and approval -> execution -> closure and handover -> results and benefits realization`.
- The intended initiative object should accept many entrypoints: `Idea`, `Tools`, `Assessment`, `Interview`, `Chat`, and manual creation.
- The module should own governance, planning quality, timeline/capacity logic, stakeholder roles, readiness, and downstream continuity into `Execution` and `Results`.

#### 4.2 Current repo truth
- The repo has a real module surface in `src/components/Initiatives/InitiativesHub.tsx`.
- The hub supports list/kanban/timeline/matrix style work, preview/document views, bulk updates, create flow, pending decision readback, and governed initiative snapshot hydration.
- The V8 backend read model is rich in `server/src/routes/v8/planning.routes.ts`: portfolio, detail, dependencies, watchers, stakeholders, gate roles, status history, comments, resources, KPIs, budget items, tools, intangible assets, RAID, decision chains, critical path and WBS completeness.
- The planning runtime itself is not shallow; `server/src/services/v8/planningContinuityService.ts` models WBS depth, cross-initiative dependencies, material change detection and decision chains.
- What is genuinely usable now:
  - portfolio read and filtering through governed V8-first portfolio continuity
  - initiative preview/detail opening
  - pending decisions visibility
  - basic create and quick-edit behaviors
- What is still partial or split:
  - reads are V8-first, but create/status/quick-update still go through legacy `/initiatives` paths
  - gate-readiness check is still loaded from legacy initiative routes
  - document-level governance is stronger than the creation/edit lifecycle shown to the user
  - demo/showcase behavior still coexists with live logic inside the hub

#### 4.3 Competitive standard
- `Asana` teaches the user to expect one place for initiative status, workload, milestones, updates and portfolio rollups.
- `monday.com` teaches strong portfolio-to-project synchronization, board-level execution visibility and operational dashboards that roll up automatically.
- The repo benchmark in `PROJECT_MANAGEMENT_V8_BENCHMARK.md` adds `Linear` and `ClickUp` lessons: triage before execution, one clear initiative hierarchy, AI inside the work system, and lifecycle continuity from intake to closure.
- Market standard now means:
  - one initiative object with visible readiness and planning quality
  - explicit portfolio rollups
  - no ambiguity about whether editing an initiative mutates the primary truth
  - one path from initiative into execution and results

#### 4.4 Main gaps
- 7-dimension assessment:
  - `User value`: `medium-strong`. Users can browse and act, but the module still feels more like a strong shell around mixed runtime paths than a fully trusted planning spine. Main gap: governed write truth is not yet the visible default.
  - `Flow completeness`: `medium`. The read story is stronger than the create-review-approve-execute story. Main gap: the main lifecycle crosses V8 reads and legacy writes.
  - `UX quality`: `medium-strong`. The hub is substantial, but the mental model is still heavier than leaders like Linear/Asana. Main gap: readiness, approvals and next-step clarity are not strong enough on the core happy path.
  - `Data / logic quality`: `strong`. WBS, dependencies, decision chains and snapshot logic are real. Main gap: productized exposure of this logic is uneven.
  - `Integration quality`: `medium`. The module conceptually anchors execution/results/finance, but runtime bridging remains partial. Main gap: source-to-initiative and initiative-to-execution continuity is not surfaced as one canonical path.
  - `Trust / governance / error handling`: `medium`. Governance data exists, but the visible write path is still mixed. Main gap: users cannot easily tell when they are on governed truth versus compatibility seam.
  - `Market standard fit`: `medium`. Stronger than a simple backlog tool, weaker than a true project operating system. Main gap: no clearly dominant initiative lifecycle surface.
- Concrete gaps:
  - no visible governed V8 write contract for initiative create/update/status on the main flow
  - no single readiness-first creation path that forces better initiative quality before execution
  - weak visible handoff from initiative planning into execution signals, KPI definitions and economics
  - initiative governance is richer in backend/docs than in the top-level user journey

#### 4.5 Minimal acceptance state now
- A user can create a new initiative from the main module without dropping onto an ambiguous legacy seam.
- The created initiative appears immediately in portfolio/list/kanban/timeline and can be opened in governed detail view.
- The user can see and trust: status history, readiness/gate state, dependencies, stakeholders, resources, KPIs and budget context from one coherent initiative document.
- The user can move an initiative through bounded lifecycle transitions with visible role/readiness rules.
- The user can hand an initiative into `Execution` and `Results` without re-entering the core context manually.
- Known limitations that do not block acceptance now:
  - no full enterprise portfolio suite beyond current scope
  - no broad AI-planning productization beyond bounded assistive flows
  - no large new PM architecture beyond existing V8 planning continuity

#### 4.6 Top missing functions
- Governed V8 create/update/status lifecycle for initiative core actions.
- One visible readiness-and-gate panel on the main initiative happy path.
- Stronger initiative source provenance at creation time.
- Clear initiative-to-execution handoff CTA and state continuity.
- Clear initiative-to-results KPI/ROI handoff CTA and state continuity.
- Portfolio rollup focused on actionability, not only browseability.
- Explicit blocked/at-risk/no-readiness states before execution.
- Better distinction between draft, approved, scheduled, executing and tracking from a user perspective.

#### 4.7 Proposed bounded delivery packets
- `Initiative Write Truth`
  - `Cel`: usunac najwazniejszy split-brain w glownym flow modulu.
  - `Zakres`: create, status change, quick update, gate readiness visibility.
  - `Co dokladnie dowozimy`: glowny happy path inicjatywy idzie przez governed V8 contract albo jawnie oznaczony contract shim; user nie trafia w ciemno na legacy persistence.
  - `Czego swiadomie nie ruszamy`: pelnego PM suite, nowych widokow portfolio, szerokiego AI planner.
  - `Proof odbioru`: user tworzy inicjatywe, aktualizuje status/owner/priority, widzi readiness i historia zmian jest spójna z detalem.
  - `Ryzyka`: legacy assumptions ukryte w quick-update i bulk-edit.
- `Initiative Readiness And Gate Clarity`
  - `Cel`: uczynic governance widocznym i praktycznym, nie tylko backendowym.
  - `Zakres`: gate-readiness, role rules, warnings, next action hints.
  - `Co dokladnie dowozimy`: user wie, dlaczego inicjatywa moze lub nie moze przejsc dalej.
  - `Czego swiadomie nie ruszamy`: rozbudowanego approval workflow poza obecnym modelem.
  - `Proof odbioru`: dla inicjatywy w `planning/review` widać blokery, wymagane role i następne kroki.
  - `Ryzyka`: rozjazd miedzy legacy readiness endpoint i V8 planning read model.
- `Initiative Spine Handoffs`
  - `Cel`: połączyć planowanie z wykonaniem i wynikami bez ręcznego przepisywania.
  - `Zakres`: handoff CTA i kontekst do `Execution` oraz `Results`.
  - `Co dokladnie dowozimy`: inicjatywa pokazuje, co przechodzi dalej i gdzie user ma pracować po planowaniu.
  - `Czego swiadomie nie ruszamy`: pełnego cross-module orchestration layer.
  - `Proof odbioru`: user z poziomu inicjatywy przechodzi do execution risk/workload i KPI/ROI z zachowanym kontekstem.
  - `Ryzyka`: zależność od jakości routingu i aliasów w innych modułach.

#### 4.8 Risks and dependencies
- Depends on `Execution` and `Results` having stable route-level entrypoints.
- Depends on keeping one initiative ID and one organization-scoped truth across modules.
- Biggest risk is silent reuse of legacy update endpoints after V8 read adoption.
- Documentation risk: original `Softs/Projekty` tree is referenced by benchmark docs but was not directly present in repo snapshot.

### Wdrozenia / Execution

#### 4.1 Intended product behavior
- `Execution` should be the operator control tower for delivery in motion.
- According to `EXECUTION_READINESS_AUDIT_V8.md` and `EXECUTION_MANAGEMENT_BENCHMARK_V8.md`, it should cover health, workload, balance, timeliness, dependencies, risk, recovery and PMO-style intervention.
- The intended experience is summary first, drill-down second, action third.
- The module should answer: what is slipping, who is overloaded, what is blocked, what decision is missing, and what to do next.

#### 4.2 Current repo truth
- There is a real `ExecutionHub` in `src/components/Execution/ExecutionHub.tsx`.
- The route still enters through `src/views/FullExecutionView.tsx`, but that wrapper now simply returns `ExecutionHub`, so the surface is effectively the new hub.
- The hub already contains meaningful views: risk signals, delay detection, workload, budget control, timeline/kanban, decisions, RAID and initiative context.
- The V8 contract in `server/src/routes/v8/execution-control.routes.ts` is real and includes:
  - risk signals read + dismiss
  - timeline warnings
  - delay signals read + detect + dismiss
  - capacity alerts and capacity timeline
  - budget summaries and budget entry create
  - RAID mitigation patch
  - bounded timeline updates
- The deeper runtime exists in `server/src/services/v8/executionVisibilityService.ts`: canonical execution signals, aggregation, results handoff events and rebaseline proposals.
- What is genuinely usable now:
  - viewing live risk/delay/timeline/capacity/budget signals
  - bounded operator actions such as dismiss, mitigation update, timeline update, budget entry
  - task and initiative status work from the hub
- What is partial:
  - the hub still mixes V8 execution-control with legacy `Api.getTasks`, `/decisions`, `/pmo/health`, `/execution/.../health`, `/action-queue`
  - capacity and delay are present, but rebalance/recovery is lighter than the control signals
  - PMO-grade cross-initiative oversight is weaker than the module’s documentation ambition

#### 4.3 Competitive standard
- `Asana` sets the expectation for connected schedule, workload and portfolio status in one operating surface.
- `monday.com` sets the expectation for visible capacity, resource planning and drill-down across boards/projects.
- `Power BI` is not the execution benchmark, but it raises the bar for how signal rollups and executive visibility should feel once dashboards exist.
- The repo benchmark in `EXECUTION_MANAGEMENT_BENCHMARK_V8.md` also explicitly references `ClickUp`, `Wrike`, `Smartsheet`, `Linear` and `Asana`, which together define the category standard:
  - honest baseline variance
  - critical-path and dependency awareness
  - visible overload
  - actionable recovery, not just red badges

#### 4.4 Main gaps
- 7-dimension assessment:
  - `User value`: `strong`. The module already helps users see real delivery risk. Main gap: intervention depth still lags behind signal depth.
  - `Flow completeness`: `medium-strong`. Monitor and inspect are stronger than recover and replan. Main gap: summary-to-action-to-recovery is not fully closed.
  - `UX quality`: `medium`. The module is rich, but the information density still feels stitched rather than designed as one control tower rhythm. Main gap: too many sub-surfaces without one dominant operator flow.
  - `Data / logic quality`: `strong`. Delay, risk, capacity and budget logic exist for real. Main gap: baseline honesty and critical-path semantics are not visible enough in the surface.
  - `Integration quality`: `medium`. V8 execution-control is real, but the hub still depends on legacy tasks/decisions/health reads. Main gap: the operator is still navigating multiple truth sources.
  - `Trust / governance / error handling`: `medium-strong`. Contracted read/write seams exist and are tested. Main gap: fallback keeps ambiguity alive.
  - `Market standard fit`: `medium`. Better than a simple task board, weaker than a true PMO control tower. Main gap: rebalancing and recovery are under-productized.
- Concrete gaps:
  - no one canonical execution data spine across all visible execution widgets
  - recovery/replan/escalation loop still weaker than detection
  - PMO rollup remains lighter than the docs imply
  - workload and timeline actions are not yet clearly connected to reallocation decisions

#### 4.5 Minimal acceptance state now
- An operator sees one trusted execution surface for risk, delays, workload, timeline warnings and budget variance.
- Every major red/amber signal has an obvious next action: dismiss, mitigate, update timeline, add budget entry, or navigate to the affected initiative/task/decision.
- The user can trust that the visible signals are organization-scoped and not synthetic placeholders.
- The execution surface makes missing baseline / weak confidence visible instead of hiding uncertainty.
- Known limitations that do not block acceptance now:
  - no full enterprise PMO suite
  - no broad predictive AI execution program
  - no giant multi-board resource optimizer

#### 4.6 Top missing functions
- One fully governed execution data spine for visible widgets.
- Better recovery workflow after risk/delay detection.
- Stronger baseline and forecast-confidence visibility in the surface.
- Cross-initiative PMO rollup that is action-oriented, not only summary-oriented.
- Better reallocation and smoothing workflow for overload.
- Stronger pending-decision integration in the same control surface.
- Explicit dependency blast-radius visibility on main operator paths.
- Rebaseline workflow surfaced to the operator where justified.

#### 4.7 Proposed bounded delivery packets
- `Execution Truth Spine`
  - `Cel`: zredukowac mieszanie V8 i legacy w aktywnym control tower.
  - `Zakres`: risk, delay, capacity, timeline, budget, health/action queue entrypoints.
  - `Co dokladnie dowozimy`: główne kafle i listy opierają się na jednej jawnej warstwie contractowej.
  - `Czego swiadomie nie ruszamy`: nowego wielkiego PMO produktu.
  - `Proof odbioru`: operator przechodzi przez główny flow bez trafiania w niekonsekwentne dane z różnych źródeł.
  - `Ryzyka`: część legacy health APIs może nie mieć pełnego odpowiednika V8.
- `Execution Intervention Loop`
  - `Cel`: zamienić monitoring w działanie.
  - `Zakres`: mitigation, delay response, timeline update, escalation CTA.
  - `Co dokladnie dowozimy`: każdy główny sygnał ma jednoznaczną ścieżkę interwencji.
  - `Czego swiadomie nie ruszamy`: pełnego predictive AI dla execution.
  - `Proof odbioru`: user z poziomu risk/delay panelu kończy akcję naprawczą i widzi efekt.
  - `Ryzyka`: zależność od task/decision legacy paths.
- `Execution PMO Rollup`
  - `Cel`: doprowadzić moduł do minimalnego standardu control tower dla wielu inicjatyw.
  - `Zakres`: portfolio-wide health, top blockers, overload, timeline drift.
  - `Co dokladnie dowozimy`: kierownik portfela dostaje jeden sensowny widok run-the-portfolio.
  - `Czego swiadomie nie ruszamy`: pełnej warstwy portfelowej poza aktualną falą.
  - `Proof odbioru`: w jednym ekranie widać które inicjatywy wymagają uwagi i dlaczego.
  - `Ryzyka`: jeśli dane bazowe są niepełne, dashboard może wyglądać mocno, ale nieuczciwie.

#### 4.8 Risks and dependencies
- Strong dependency on `Inicjatywy` lifecycle truth.
- Strong dependency on route-level coherence for tasks and decisions.
- Results handoff exists in runtime doctrine, but is not yet a first-class visible operator action.
- Biggest risk is shipping a nice control surface whose action layer still silently depends on legacy behavior.

### KPI / BI / Results

#### 4.1 Intended product behavior
- `Results` should be the evidence and intervention layer of the transformation system.
- According to `RESULTS_V8_SSOT.md`, it must own KPI definitions, freshness, deviations, corrective actions, ROI registry, executive review, and links back to initiatives, tasks and decisions.
- The module must support both initiative-linked KPI/ROI and standalone operational KPI/ROI modes.
- `Results` should trigger reconciliation when KPI truth and finance interpretation diverge; `Finance` resolves finance-side meaning.

#### 4.2 Current repo truth
- The main surface exists in `src/components/Results/ResultsHub.tsx`.
- The route layer is serviceable but semantically messy:
  - `ROUTES.KPI_OKR` redirects through `src/views/KpiOkrView.tsx` to `ROUTES.BENEFITS`
  - `ROUTES.BENEFITS` is the route that actually renders `ResultsHub`
- The hub is real and useful: summary, KPI list, KPI reports, ROI, operational analysis, ROI analysis, KPI create modal, KPI drawer, ROI open modal and ROI detail drawer.
- The V8 backend in `server/src/routes/v8/results.routes.ts` is materially complete for the active scope:
  - dashboard
  - KPI catalog
  - KPI create/update/delete
  - time-series record
  - deviation workflow actions
  - ROI portfolio summary and initiative detail
  - report snapshot generation
- `server/src/services/v8/resultsROIService.ts` provides real KPI/deviation/ROI/reconciliation logic.
- What is genuinely usable now:
  - KPI catalog with linked initiatives
  - KPI create/delete/update on bounded V8 seams
  - time-series and deviation workflows
  - ROI tracking and detail drill-down
  - KPI report generation
- What is partial:
  - fallback to legacy benefits routes still exists in the hub for some flows
  - route naming still tells the user an older product story (`Benefits`) instead of `Results`
  - scorecards/OKR/executive review are stronger in SSOT than in the visible main surface

#### 4.3 Competitive standard
- `Microsoft Power BI` sets the expectation for KPI dashboards, scorecards, goal tracking, history, subscriptions and executive-friendly visibility.
- `Asana` and `monday.com` raise the bar for tying goals and rollups to active project execution, not leaving KPIs as isolated charts.
- The current category standard is:
  - KPI definition + drill-down + freshness
  - clear deviation ownership and action
  - scorecards or goal trees that executives can actually use
  - route and terminology clarity
  - no ambiguity between performance truth and financial interpretation

#### 4.4 Main gaps
- 7-dimension assessment:
  - `User value`: `strong`. Users can already define and track meaningful KPI/ROI flows. Main gap: strategic scorecard layer is weaker than the operational KPI loop.
  - `Flow completeness`: `strong-medium`. KPI create -> measure -> deviate -> act is real. Main gap: KPI/OKR/scorecard/executive review continuity is incomplete on the surface.
  - `UX quality`: `medium`. The module is useful, but the naming and route history still make it feel less intentional than it should. Main gap: `Results` still presents itself partly as legacy `Benefits`.
  - `Data / logic quality`: `strong`. KPI, deviation and ROI logic are real and tested. Main gap: the richer scorecard and review layer is not equally visible.
  - `Integration quality`: `medium-strong`. Links to initiatives and finance exist, but are not always obvious in the main journey. Main gap: cross-module semantics are clearer in docs than in the surface.
  - `Trust / governance / error handling`: `medium-strong`. V8 write seams and tests are good. Main gap: fallback keeps the door open for uncertainty.
  - `Market standard fit`: `medium-strong`. Stronger than a decorative BI tab, weaker than a polished goal/performance platform. Main gap: scorecard and executive review productization.
- Concrete gaps:
  - route and naming coherence are below product-standard quality
  - scorecard/OKR/executive review layer is underexposed
  - KPI-to-initiative and KPI-to-finance interpretation could be clearer in visible flows
  - legacy fallback still survives in a module that is already close to acceptance quality

#### 4.5 Minimal acceptance state now
- The user can create and manage KPI definitions from the main `Results` surface.
- The user can record time-series values, see freshness and status, and handle deviation cases through acknowledgement, RCA, actions and closure.
- The user can manage ROI assumptions and realized entries and understand variance.
- The user can generate at least one meaningful review/report artifact from current KPI truth.
- The user can understand how KPI truth relates to initiatives and, where applicable, finance interpretation.
- Known limitations that do not block acceptance now:
  - no full enterprise scorecard suite
  - no giant standalone BI platform
  - no broad 8.2-level executive review program

#### 4.6 Top missing functions
- Results-first route and terminology cleanup.
- Stronger scorecard / OKR / executive review visibility.
- Clearer KPI-to-initiative action linkage in the main UI.
- Clearer KPI-to-finance reconciliation status surfacing.
- Better strategic summary layer above the KPI table.
- Better visible freshness and trust explanation for executives.
- Stronger distinction between operational KPI mode and initiative-linked mode.

#### 4.7 Proposed bounded delivery packets
- `Results Naming And Route Truth`
  - `Cel`: usunac mylący produktowo alias `Benefits`.
  - `Zakres`: route labels, breadcrumbs, module naming, top-level entry expectations.
  - `Co dokladnie dowozimy`: user trafia do `Results`, nie do historycznego bytu o innej nazwie.
  - `Czego swiadomie nie ruszamy`: pełnej reorganizacji menu poza zakresem frozen layout.
  - `Proof odbioru`: główne wejście, breadcrumbs i CTA mówią jednym językiem `Results / KPI / ROI`.
  - `Ryzyka`: frozen layout nie pozwala na dowolne przetasowania, więc trzeba pracować na nazewnictwie i route aliasach.
- `KPI Governance Happy Path`
  - `Cel`: domknąć najlepszy istniejący flow modułu jako wzorzec odbioru.
  - `Zakres`: create, measure, deviation, corrective action, close.
  - `Co dokladnie dowozimy`: jeden spójny, testowalny KPI lifecycle z czytelnymi stanami i zaufaniem.
  - `Czego swiadomie nie ruszamy`: szerokiego BI authoringu.
  - `Proof odbioru`: user kończy pełen loop KPI bez dead-endów i bez niejawnego legacy fallback.
  - `Ryzyka`: część pobocznych ekranów może nadal bazować na starych nazwach.
- `Scorecard And Executive Layer`
  - `Cel`: przestać wyglądać jak tylko KPI table.
  - `Zakres`: summary, review cadence, scorecard/executive visibility na poziomie minimalnego odbioru.
  - `Co dokladnie dowozimy`: menedżer rozumie co jest zdrowe, co odchyla się i gdzie działać.
  - `Czego swiadomie nie ruszamy`: pełnego corporate BI suite.
  - `Proof odbioru`: na wejściu do modułu widać stan wyników i najważniejsze wyjątki, nie tylko listy.
  - `Ryzyka`: zależność od jakości danych wejściowych z initiative/execution.

#### 4.8 Risks and dependencies
- Depends on `Inicjatywy` for clean initiative-linked KPI context.
- Depends on `Finance` for reconciliation meaning, but `Results` must remain the runtime trigger.
- Strong risk of semantic confusion if route/name cleanup is skipped.
- Documentation risk: `RESULTS_V8_BENCHMARK.md` and `RESULTS_V8_READINESS_AUDIT.md` are referenced by `SYSTEMATYKA_PRZEGLADU_V8.md` but were not present in this repo snapshot.

### Finanse

#### 4.1 Intended product behavior
- `Finanse` is intended to be an AI-driven financial workbench, not only an upload-and-report area.
- According to `FINANCE_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`, the full movement should be `recognized source -> model -> analysis or budget or valuation -> note or idea or initiative or report or presentation`.
- According to `FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`, the module should also grow into a CFO control surface: liquidity watch, covenant watch, capital allocation, budget review cadence and board-grade packs.
- The intended differentiation is one connected finance system linking ingestion, modeling, planning, valuation, initiative economics and downstream outputs.

#### 4.2 Current repo truth
- The product surface is real in `src/components/Economics/FinanceHub.tsx`.
- `/finance` and `/economics` both resolve to `src/views/EconomicsView.tsx`, which simply renders `FinanceHub`.
- The hub already supports several serious surfaces:
  - statement import and statement pack workspaces
  - model workspace
  - financial analysis
  - budgets/predictions
  - valuation
  - export to outputs
- The V8 backend in `server/src/routes/v8/finance.routes.ts` is the broadest runtime surface in this plan: dashboard, models, analyses, budgets, valuations, statement ingestion, extraction, mapping, validation, approvals, compute flows and diagnostics.
- `server/src/services/v8/financeIntegrationService.ts` adds real runtime constructs for ingestion pipeline, economics linkage, promotion gates, delta escalation and source refresh.
- What is genuinely usable now:
  - import of PDF/XLSX/CSV statements
  - statement pack evaluation and mapping
  - model creation and computation
  - analysis, budget and valuation surfaces
  - promotion/export actions
  - V8 dashboard visibility for ingestion/linkage health
- What is partial:
  - some statement detail/pack reads still fallback to legacy finance-statements endpoints
  - product naming still says `Economics` in parts of the route layer while the module is really `Finance`
  - the visible UI is stronger as analyst workspace than as CFO operating system
  - the breadth of runtime can create a false sense that governance and review are equally mature on the surface

#### 4.3 Competitive standard
- `Pigment` sets the expectation for modern scenario planning, rolling forecast, variance analysis, governed model evolution and auditable AI-assisted model building.
- `Power BI` is relevant secondarily on the presentation side, but the core finance benchmark here is planning/modeling/governance rather than dashboarding alone.
- The repo’s finance doctrine also implies expectations closer to enterprise FP&A and CFO workflows:
  - source traceability
  - validation and tie-out
  - scenario compare
  - approval/review cadence
  - initiative economics linkage
- Market standard now means:
  - import is not enough
  - models must be explainable and governable
  - budgets/forecasts/valuations must stay linked
  - review/governance must be visible, not hidden in service depth

#### 4.4 Main gaps
- 7-dimension assessment:
  - `User value`: `strong`. Users can do real finance work. Main gap: the strongest user-facing value is still analyst productivity, not full CFO control.
  - `Flow completeness`: `medium-strong`. Ingestion to model and analysis is real; CFO governance and broad downstream orchestration are less productized. Main gap: review and governance cadence is weaker than the working surface.
  - `UX quality`: `medium`. The hub is large and capable, but the conceptual model is heavy. Main gap: too much breadth without a dominant north-star journey per persona.
  - `Data / logic quality`: `strong`. Backend/runtime depth is real. Main gap: some read continuity still depends on legacy seams.
  - `Integration quality`: `strong-medium`. Finance already links to initiatives/results/outputs in doctrine. Main gap: the visible path from finance insight to governed initiative/results action is not strong enough.
  - `Trust / governance / error handling`: `medium-strong`. Mapping, validation and diagnostics are substantial. Main gap: visible CFO review and escalation semantics are still thinner than the runtime package.
  - `Market standard fit`: `medium-strong`. Stronger than a basic finance tab, weaker than a fully productized FP&A/CFO platform. Main gap: scenario/governance/cadence layer needs sharper surface expression.
- Concrete gaps:
  - route and naming coherence still split `Finance` vs `Economics`
  - statement detail continuity still partially relies on fallback
  - no dominant visible CFO cockpit
  - initiative economics and downstream promotion are documented more strongly than they are surfaced
  - the module risks feeling expert-only instead of guided enough for normal consulting workflows

#### 4.5 Minimal acceptance state now
- A user can import finance source files and reach a usable statement pack with visible readiness/quality state.
- A user can turn statement evidence into a model, run analysis/budget/valuation, and inspect validations or ratio outputs.
- A user can export or promote finance work into downstream artifacts without losing source traceability.
- A user can understand whether the finance object is ready, linked, stale, escalated or review-worthy.
- Known limitations that do not block acceptance now:
  - no full corporate EPM suite
  - no broad board-management product
  - no full 8.2-level outputs authoring program

#### 4.6 Top missing functions
- Finance/Economics route and terminology coherence.
- One dominant statement-to-model-to-analysis happy path.
- Stronger visible linkage from finance work to initiatives/results.
- CFO cockpit starter layer for liquidity, review and escalation.
- More obvious review cadence and approval states in the main surface.
- Better guided empty states and next-step CTAs per finance persona.
- Better visible stale-source and promotion-gate statuses.
- Reduced reliance on legacy statement detail fallback.

#### 4.7 Proposed bounded delivery packets
- `Finance Truth And Terminology`
  - `Cel`: usunac semantyczny chaos `Finance` vs `Economics`.
  - `Zakres`: route labels, breadcrumbs, module naming, main entrypoints.
  - `Co dokladnie dowozimy`: user wie, że pracuje w module finansowym, nie w historycznym aliasie.
  - `Czego swiadomie nie ruszamy`: wielkiej przebudowy IA całej aplikacji.
  - `Proof odbioru`: główne wejścia, nazwy i CTA są spójne dla finance workflows.
  - `Ryzyka`: starsze komponenty i help content mogą używać obu nazw naraz.
- `Statement To Model Happy Path`
  - `Cel`: zrobic jeden mocny odbiorowy flow, nie tylko szeroki toolbox.
  - `Zakres`: import, readiness, mapping, pack detail, create model.
  - `Co dokladnie dowozimy`: analityk przechodzi od pliku do pierwszego sensownego modelu bez błądzenia po pobocznych zakładkach.
  - `Czego swiadomie nie ruszamy`: pełnej automatyzacji AI mapping na poziomie 8.2.
  - `Proof odbioru`: user importuje plik, widzi readiness, poprawia mapowanie tam gdzie trzeba i tworzy model.
  - `Ryzyka`: fallback do legacy statement detail może ukrywać realny brak contract parity.
- `Finance To Governance`
  - `Cel`: dodać minimalny CFO/review sens, żeby moduł nie kończył się na analizie.
  - `Zakres`: dashboard linkage health, delta escalation, initiative economics, review CTA.
  - `Co dokladnie dowozimy`: finance insight może przejść do decyzji, inicjatywy lub review bez utraty kontekstu.
  - `Czego swiadomie nie ruszamy`: pełnego CFO OS.
  - `Proof odbioru`: user z analizy przechodzi do inicjatywy / ROI / review i widzi traceability oraz status bramek.
  - `Ryzyka`: zależność od jakości `Results` i `Inicjatywy` handoffów.

#### 4.8 Risks and dependencies
- Depends on `Inicjatywy` for credible initiative-economics linkage.
- Depends on `Results` for KPI-finance reconciliation starting point.
- Biggest risk is overclaiming finance readiness because backend depth is broad.
- Documentation risk: `FINANCE_V8_SSOT.md`, `FINANCE_V8_BENCHMARK.md` and `FINANCE_V8_READINESS_AUDIT.md` are cited in `SYSTEMATYKA_PRZEGLADU_V8.md` but were not present in this repo snapshot.

## 5. Cross-module dependencies
- `Inicjatywy` is the anchor object for the whole scope. If initiative truth remains mixed, `Execution`, `Results` and `Finance` will continue to feel stitched.
- `Execution` depends on initiative lifecycle quality to make risk, delay, baseline and workload signals credible.
- `Results` depends on initiative context for transformation-linked KPI/ROI, but must also preserve standalone KPI/ROI mode.
- `Results` starts KPI-finance reconciliation; `Finance` resolves finance-side meaning. That division should not be blurred.
- `Finance` should be able to promote into `Inicjatywy` and `Results`, but only through governed, traceable proposals.

## 6. Recommended execution order
- `Packet 1 - Initiative Write Truth`
  - Without this, the rest of the spine keeps inheriting planning ambiguity.
- `Packet 2 - Execution Truth Spine`
  - Once initiatives are stable, the operator layer should stop mixing visible truth sources.
- `Packet 3 - Results Naming And Route Truth`
  - Cheap, high-visibility improvement that removes semantic confusion around a module already close to usable.
- `Packet 4 - KPI Governance Happy Path`
  - This turns `Results` into a clearly shippable evidence loop, not just a promising module.
- `Packet 5 - Statement To Model Happy Path`
  - Finance is already deep; the fastest honest product gain is making the primary analyst flow unmistakable.
- `Packet 6 - Initiative Readiness And Gate Clarity`
  - After write truth and adjacent handoffs are stable, governance should become visible and practical.
- `Packet 7 - Execution Intervention Loop`
  - This upgrades `Execution` from alert console to action console.
- `Packet 8 - Finance To Governance`
  - Only after `Inicjatywy` and `Results` are more coherent should finance-to-decision/review handoff be sharpened.
- `Packet 9 - Scorecard And Executive Layer`
  - Valuable, but should land after the KPI/ROI core path is clean.
- `Packet 10 - Execution PMO Rollup`
  - High-value once the underlying initiative and execution seams are more trustworthy.

## 7. Final recommendation
- Treat this 4-module scope as one operating spine, not four unrelated hubs.
- Do not start with visual polish. Start with route/write-truth coherence where the user can most easily feel split-brain: `Inicjatywy`, `Execution`, `Results`, then `Finanse`.
- Do not open a new architecture. The repo already has enough runtime depth; the problem is productized continuity and honest surface truth.
- Do not accept any module as "ready" just because its V8 route exists. Read-path parity is not enough if the visible write path or route semantics still default to legacy logic.
- Do not skip terminology cleanup in `Results` and `Finance`. Naming drift is not cosmetic here; it directly degrades trust and makes the platform look half-migrated.
- Do not overextend `Finance` into a broad CFO product in this wave. The correct move now is to make one excellent analyst-to-governance path and one excellent statement-to-model path.
- Do not underinvest in `Inicjatywy`. It is the leverage point for everything else in this scope.
- Most importantly: the minimal acceptance target is not "these hubs exist". It is that a serious user can move from initiative intent, through execution control, into KPI/ROI proof, and into finance interpretation without hitting invisible truth seams or product-language confusion.
