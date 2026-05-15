# Final Implementation Contract — KPI (Position 4/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `verified(evidence)` — P04-A through P04-H closed  
Last updated: 2026-04-11 (full-scope contract update — P04-D/E verified, P04-F/G/H registered)

## 1. Executive summary
- **Intent**: KPI są dobrze opisane — teraz trzeba je dobrze zbudować.
- **Primary users**: operatorzy wyników (management/PMO/owner).
- **Success metric**: KPI to nie „dashboard” tylko lane: signal → report/reconciliation → next action, spójne z konsekwencjami finansowymi.

## 2. Scope
### 2.1 In-scope
- KPI inspection + report workflow + reconciliation semantics (P04-A/B/C).
- KPI ↔ finanse: konsekwencje i spójność runtime na deklarowanych ścieżkach (P04-A/B/C).
- Operator cockpit surfaces: Overview / Queue / Catalog + template-first reports with refresh (P04-D).
- Enterprise distribution: Schedules / Wallboards / Connectors + Goals / Scorecards (P04-E).
- Full KPI operator drawer: 7-tab governed workspace with deviation lifecycle + metric audit (P04-F).
- AI-assisted operations: report narrative drafts, signal sheet generation, KPI chat context (P04-G).
- KPI attribution + showcase: initiative contribution estimation, demo data layer (P04-H).

### 2.2 Out-of-scope / non-goals
- Pełny BI suite (Looker/Tableau parity).
- “Wykresy bez zamknięcia pętli” (to jest anty-cel; KPI ma kończyć się decyzją i akcją).
- Zastąpienie modułu `Finanse` i `Wdrożenia` (KPI ma je zasilać i linkować, nie przejmować).
- Full governed MetricDefinition UX (dimensions/slices/provenance — backend primitives exist, full UI deferred to post-V8.1).
- Wallboard TV-mode presentation view (data layer exists, dedicated display deferred).
- Scheduled report notification/approval workflow chain (API exists, notification bus deferred).

## 3. Authority chain (SSOT)
- Full-system canon: `docs/product/KPI_FULL_SYSTEM_CANON_V8.md`
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`
- SSOT: `docs/product/RESULTS_V8_SSOT.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

Interpretation note:

This implementation contract remains the verified historical bounded-lane contract for Wave 1 / V8.1.
The broader target state for cross-module KPI evolution now lives in `docs/product/KPI_FULL_SYSTEM_CANON_V8.md`.

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 KPI` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Quantive (OKR/KPI operating module)**:
  - `Softs/0 KPI/ QUANTIVE/help.quantive.com/en/articles/10738974-revamped-kpi-module-beta.html` (KPI page: filters, tags, grid, bulk actions, saved/shared views).
  - `Softs/0 KPI/ QUANTIVE/help.quantive.com/en/articles/11154200-kpi-chart.html` (KPI chart: periods, aggregation, calculation methods, color-coding, stats cards).
  - `Softs/0 KPI/ QUANTIVE/help.quantive.com/en/articles/11144303-kpi-targets.html` (targets: projection line; prerequisites/permissions; activity history for targets).
- **Databox (metric builder / data source → metric)**:
  - `Softs/0 KPI/Databox/help.databox.com/overview-metric-builder-for-postgresql.html` (Metric Builder: custom metrics via SQL; add to dashboard; constraints like Date column).
- **WorkBoard (operating rhythm + scorecards; anti-vanity doctrine)**:
  - `Softs/0 KPI/WORKBOARD 1/www.workboard.com/resources/blog/avoid-vanity-metrics.html` (“watermelon/vanity metrics” as false-positive signals; focus on what matters).
  - `Softs/0 KPI/WORKBOARD 1/www.workboard.com/resources/blog/reviews-with-scorecards.html` (scorecard as “metrics-on-a-page” + commentary + go-forward plan; reduces manual deck-making).
- **Perdoo (KPI vs OKR doctrine)**:
  - `Softs/0 KPI/PERDOO 1/www.perdoo.com/resources/ebooks-downloads/cheat-sheet-kpis-vs-okrs.html` (doctrine framing KPIs vs OKRs; strategic clarity).
- **Adjacents present in Softs** (not fully distilled here): `Looker`, `Tableau`, `Databox`, `Workboard`, `Perdoo` folders under `Softs/0 KPI/`.

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “closed-loop results lane”, nie “BI dashboard builder”.**

- **KPI grid as an operator surface (Quantive)**:
  - Filtry (owner/tag/time period), wyszukiwanie, sortowanie.
  - Widoki zapisane i współdzielone (transparency + alignment).
  - Bulk actions (np. assignment, szybkie tagowanie).
- **KPI chart semantics (Quantive)**:
  - Agregacje (daily/weekly/monthly/quarterly/yearly) + spójność z zakresem czasowym.
  - Metody obliczeń (last/sum/average) jako jawny kontrakt.
  - Color-coding zrozumiały dla operatora (“trend vs direction”).
  - Statystyki typu period-to-date / period-on-period / target vs actual (czytelne, nie mylące).
- **Targets & projection line (Quantive)**:
  - KPI targets jako linia oczekiwań; wymagania uprawnień; edycja i historia zmian (activity log).
- **Scorecards & review cadence (WorkBoard)**:
  - Scorecard = metryki + komentarz + plan działań; ma redukować “deck work” i spory o dane.
- **Anti-vanity & signal honesty (WorkBoard)**:
  - KPI musi unikać “watermelon metrics” i wymuszać jasną semantykę: co jest sygnałem, co jest konsekwencją, co jest działaniem.
- **Metric definition / sourcing (Databox)**:
  - Jawne źródło danych i definicja metryki (np. custom metric builder / query); walidowalność.
- **Consultify-specific bridge (Wave1 intent)**:
  - KPI → Finance consequence → Execution follow-up: spójne przejścia, bez split-truth.

### 4.4 Gap ledger vs Softs (status as of 2026-04-11; what we have delivered and what remains — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md` + linkage SSOT.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (2026-04-11) | Status | Priority |
| --- | --- | --- | --- | --- |
| Closed-loop workflows | KPI must lead to report + reconciliation | Delivered (P04-B): `kpiWorkflowCanon.ts` + 6 workflow endpoints + E2E test | CLOSED | P0 |
| Reconciliation semantics | explicit discrepancy handling | Delivered (P04-B): `initiateReconciliation` / `resolveReconciliation` + 4 degraded states | CLOSED | P0 |
| KPI↔Finance coherence | consequence lane must be coherent | Delivered (P04-B): linkage patterns + W6-5 ownership + no split-truth tests | CLOSED | P0 |
| KPI as operating system (not only dashboard) | scorecard + commentary + next action | Delivered (P04-D/E): goals/scorecards + next-action flows + report templates | CLOSED | P1 |
| Operator cockpit surfaces | overview + queue + governed catalog | Delivered (P04-D): `KpiOverviewView` + `KpiQueueView` + catalog modes in `ResultsHub` | CLOSED | P0 |
| Reporting artifact maturity | template identity + scope load + refresh | Delivered (P04-D): 5 templates + snapshot refresh + task materialization | CLOSED | P0 |
| Alert and queue semantics | stale / below / discrepancy / requires-review lanes | Delivered (P04-D): queue groups (needsEntry/belowTarget/discrepancy/requiresReview) + AI signal sheets | CLOSED | P1 |
| Metric foundation maturity | governed definitions, dimensions, slices, provenance | Partial: semantic layer migration 631 exists; drawer Lineage tab shows connectors + mappings; full dimensions/slices UI deferred to post-V8.1 | OPEN (deferred) | P0 |
| Goals / scorecards runtime | goals, check-ins, roll-ups, status rules | Delivered (P04-E): `ResultsKpiScorecardsView` + goals API + rollup + initiative linking | CLOSED | P0 |
| Distribution surfaces | schedules, wallboards, connector posture | Delivered (P04-E): `ResultsReportingEnterpriseViews` (schedules/wallboards/connectors) fully functional | CLOSED | P0 |
| Governance and audit posture | lineage, permission posture, audit cues | Partially delivered (P04-B/F): `canPerformKpiAction` + metric audit log + degraded posture + lineage tab; full provenance UI deferred | PARTIAL | P1 |

## 5. Product contract (user-facing)
### 5.1 Primary flows
- KPI signal → inspect → report workflow → reconciliation → next action.
- KPI target drift → interpret (trend vs direction) → decide → create/track follow-up.
- KPI discrepancy vs finance → reconciliation state → action owner → resolution.

### 5.2 UI surfaces / entry points
- KPI grid (filter/search/views/bulk) + KPI detail (chart + targets + activity).
- “Scorecard / report” surface: metryki + komentarz + plan działań.
- Link-out: KPI → finance consequence → execution follow-up (z zachowaniem kontekstu).

## 6. Evidence plan (DoD)
### 6.1 Acceptance criteria
- Użytkownik przechodzi KPI→report→reconciliation bez domysłów: są jawne stany i “next action”.
- KPI target/aggregation/trend nie wprowadza w błąd (direction + color-coding + period semantics).
- KPI→Finance consequence działa i nie prowadzi do split-truth na deklarowanym zakresie.

### 6.2 Tests
- Integracyjne: KPI↔Finance linkage (z `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`).
- Workflow regression: report generation → reconciliation → follow-up creation.
- Permissions: kto może edytować KPI/targets vs kto tylko przegląda.

### 6.3 Staging proof checklist
- Demo “discrepancy”: KPI signal → report → reconciliation state → finance consequence drill-down → execution follow-up.
- Demo “targets”: ustaw target → odczytaj “target vs actual” → zapisz komentarz/plan działań w scorecard/report.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 6.

### 8.1 Bounded delivery packets
#### P04-A — KPI canon + scope approval
- **Goal**: zatwierdzić scope KPI jako **closed-loop Results lane** (nie BI suite) oraz zamrozić kanon: vocabulary, linkage boundaries, permissions, workflow contract, degraded/error posture, anti-duplicate gates.
- **Inputs required**: `RESULTS_V8_SSOT.md` + `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` (authority chain, doctrine).
- **DoD**: `approved(scope)` gdy poniższy kanon jest jednoznaczny i testowalny (akceptacja + non-goals + degraded).

##### 8.1A Frozen KPI vocabulary (canon)
These terms are product-contract vocabulary (no synonyms in core UX copy / APIs / docs without an explicit mapping):

- **signal**: detection that a KPI requires inspection (e.g., deviation, freshness issue, discrepancy vs Finance interpretation). Signal never equals “a chart”.
- **target**: governed expectation for a KPI over a defined window; has owner + change history; is not a “forecast”.
- **trend**: direction-of-change over a declared window + aggregation method (explicit); trend is not the same as performance vs target.
- **report / scorecard**: operator artifact that snapshots KPI state + context + commentary + explicit next actions; not a slide deck and not a BI dashboard.
- **reconciliation**: governed comparison of Results KPI truth vs Finance interpretation/model truth when linkage exists (statusful, owned, explained; never silent).
- **next action**: explicit follow-up decision and assignment created from inspection/report/reconciliation; cannot be omitted when a signal exists.

##### 8.1B Frozen KPI → Finance linkage boundaries (in-lane vs non-goal)
Reference doctrine: `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` + Results SSOT reconciliation ownership (W6-5).

- **In-lane (KPI owns)**:
  - KPI truth (definition, values, freshness, deviations) stays governed in Results.
  - Link metadata exists as governed objects (link mode + rationale + status).
  - Reconciliation **trigger + primary runtime anchor** starts in Results.
  - Discrepancy visibility is explicit (difference summary + alignment checks + notes).
- **In-lane (Finance owns)**:
  - Finance interpretation, finance model truth, CFO review semantics and finance-side resolution.
- **Non-goals / out-of-lane**:
  - No “merge into one number”: Results values must not be overwritten by Finance models, and Finance models must not be overwritten by Results values.
  - No parallel “finance truth” inside KPI (no budget/model editor in KPI).
  - No BI-suite parity as a path to resolve discrepancy (no “just chart it” as reconciliation).

##### 8.1C Frozen permissions model (targets/definitions vs view/comment)
Minimum permission envelope (exact role names may map to existing RBAC later, but semantics are frozen here):

- **KPI Owner / Results Operator (edit)**:
  - Can edit KPI definition (name, description, formula metadata, slices/dimensions *if in-scope*), can set/edit targets, can start and manage reconciliation from Results, can create/assign next actions.
- **Finance Owner / Finance Analyst (edit finance-side only)**:
  - Can edit finance artifacts and provide finance interpretation, can update reconciliation notes/status from finance side where the workflow allows, cannot overwrite KPI truth.
- **Viewer (read)**:
  - Can view KPI, targets, reports/scorecards, linkage status, reconciliation status and history.
- **Commenter (read + comment)**:
  - Viewer rights + can comment on reports/scorecards/reconciliation threads, cannot edit definitions or targets.

Hard rules:
- Target edits and definition edits are never available to plain viewers/commenters.
- Permission denied must be explicit (no silent “UI disappears” without an explanation state).

##### 8.1D Frozen “closed-loop” workflow contract
Canonical workflow (must be supported end-to-end in bounded scope):

`signal → inspect → report/scorecard → reconcile (optional, if linkage/discrepancy) → next action`

Contract rules:
- A **signal** must always lead to an **explicit operator decision** (either “acknowledged with reason” or “next action created”).
- A **report/scorecard** is the durable operator artifact; it carries snapshot context + commentary + action plan.
- **Reconciliation** is required when linkage exists and discrepancy is detected (or when operator explicitly requests it).
- **Next action** must be assignable and traceable to the originating KPI + report (no orphan actions).

##### 8.1E Anti-duplicate gate (prevent drift)
This packet freezes anti-duplicate constraints:

- No BI-suite drift: KPI is not a dashboard builder; dashboards/wallboards remain separate surfaces and must consume governed metric truth.
- No parallel finance truth: KPI cannot become a finance model editor or shadow ledger.
- No “charts-only KPI”: charting without report/scorecard + next action semantics is considered incomplete (anti-goal).
- One vocabulary: “signal/target/trend/report/reconciliation/next action” are canonical across Results/Reports/Presentations consumers.

##### 8.1F Degraded / error posture (must be explicit states)
When the system cannot provide the ideal loop, it must degrade visibly with a clear next step:

- **Missing data**: show “missing/stale/untrusted” state + last refresh + source explanation; disable misleading trend/target comparisons.
- **Discrepancy unresolved**: keep reconciliation state visible (e.g., `pending`, `requires review`); block “close as resolved” without an owner action.
- **Linkage unavailable**: show “link missing/unavailable” with rationale; allow creating an operational report/next action without finance linkage.
- **Permission denied**: show explicit denied state and what capability is blocked (edit target / edit definition / manage reconciliation), without leaking restricted details.

##### 8.1G Acceptance checklist (full scope, testable — 21 items)
- [x] Vocabulary is frozen and used consistently → `kpiWorkflowCanon.ts`: `KpiSignal`, `KpiTarget`, `KpiTrend`, `KpiReport`, `KpiReconciliation`, `KpiNextAction`.
- [x] KPI is closed-loop lane, not BI suite → `KPI_ANTI_DUPLICATE_RULES.no_bi_suite_drift`.
- [x] KPI truth vs finance model truth boundary explicit → `KpiFinanceLinkMetadata` + `LINKAGE_PATTERNS` + W6-5 ownership.
- [x] Linkage optional, supports interpretation/driver/review/realization → `LINKAGE_PATTERNS`.
- [x] Reconciliation ownership frozen → `initiateReconciliation()` (Results) + `resolveReconciliation()` (Finance).
- [x] Permissions frozen and enforced on all write routes → `KPI_PERMISSION_MATRIX` + `canPerformKpiAction()` + `p04AssertKpiPermission()`.
- [x] “Permission denied” has explicit degraded posture → `computeKpiHealthPosture()` returns `permission_denied`.
- [x] “Missing data” has explicit degraded posture → `computeKpiHealthPosture()` returns `missing_data`; `/workflow/kpi/:kpiId/health`.
- [x] “Discrepancy unresolved” has explicit degraded posture → `computeKpiHealthPosture()` returns `discrepancy_unresolved`.
- [x] “Linkage unavailable” has explicit degraded posture → `computeKpiHealthPosture()` returns `linkage_unavailable`.
- [x] Anti-duplicate gates explicit → `KPI_ANTI_DUPLICATE_RULES` (4 rules) + `/workflow/contract`.
- [x] Canonical workflow explicit → `KPI_WORKFLOW_STATES` + `KPI_WORKFLOW_TRANSITIONS` + 6 workflow endpoints.

**Premium surfaces (P04-D — items 13-16):**
- [x] Operator cockpit with Overview/Queue/Catalog modes → `KpiOverviewView.tsx` + `KpiQueueView.tsx` + `ResultsHub.tsx`.
- [x] Queue semantics: needs entry / below target / discrepancy / requires review → `kpiDomain.ts` queue groups.
- [x] Template-first reports with 5 templates + snapshot refresh + task materialization → `ResultsKpiReportsView.tsx`.
- [x] Batch measurement via signal sheets → `KpiSignalSheetView.tsx`.

**Enterprise activation (P04-E — items 17-18):**
- [x] Distribution surfaces: Schedules / Wallboards / Connectors → `ResultsReportingEnterpriseViews.tsx` + `resultsEnterpriseService.ts`.
- [x] Goals / Scorecards: create, link initiatives, rollup, progress tracking → `ResultsKpiScorecardsView.tsx` + `initiativeGovernanceService.ts`.

**Operator drawer + AI + attribution (P04-F/G/H — items 19-21):**
- [x] Full 7-tab KPI drawer with deviation lifecycle + metric audit → `KPITimeSeriesDrawer.tsx`.
- [x] AI-assisted operations (report drafts, signal sheets, chat context) without silent truth mutation → `/ai/refine-text` integration.
- [x] KPI attribution and showcase/demo data layer → `kpiAttributionService.ts` + `resultsShowcaseData.ts`.

#### P04-B — Core workflow closure (signal→report→reconciliation→action)
- **Goal**: domknąć workflow i stany (w deklarowanym zakresie).
- **Acceptance**: user przechodzi E2E bez “domyślania”; nie ma split-truth na KPI↔Finance.
- **Evidence**: testy integracyjne linkage + staging demo “discrepancy”.
- **Tasks**:
  - [x] Implement the E2E KPI workflow states and transitions (bounded).
  - [x] Implement KPI→Finance consequence and ensure no split-truth.
  - [x] Add integration + workflow regression tests (6.2).
- **Staging proof script (click-by-click)**:
  1. Open `KPI` and locate a KPI with a discrepancy signal (or create one in staging data).
  2. Enter the report/scorecard flow and confirm states + “next action” are explicit.
  3. Start reconciliation and set/observe reconciliation state transitions (bounded).
  4. Drill down into finance consequence and confirm linkage is consistent (no split-truth).
  5. Create/trigger an execution follow-up and verify context is preserved.
  6. Repeat with a “targets” scenario: set a target → view target vs actual → attach comment/plan (bounded).
- **DoD**:
  - [x] “Discrepancy” demo passes; tests pass; next action is always explicit.

#### P04-C — Verification + rollout
- **Goal**: dopiąć telemetry, regresje i staging proof; przygotować bezpieczny rollout/rollback.
- **Acceptance**: wszystko spełnia bar `verified(evidence)` z playbooka.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - [x] Capture staging proofs (6.3) and fill evidence ledger rows P04-A/B/C.
  - [x] Validate rollout/rollback (read-first posture; flags).
- **DoD**:
  - [x] Status `verified(evidence)` with complete ledger entries and known limits.

#### P04-D — Premium operator surfaces extension
- **Goal**: domknąć brakujący, widoczny premium scope ponad bounded lane bez zmiany doktryny `P04`.
- **Acceptance**: użytkownik po wejściu do `Results > KPI / Reports` widzi realną różnicę względem wcześniejszego table-only lane.
- **Evidence**: UI runtime + targeted regression for cockpit/report refresh flows.
- **Tasks**:
  - [x] Dowieźć `Overview / Queue / Catalog` jako przełączalne powierzchnie pracy w `Results > KPI`.
  - [x] Wzmocnić queue semantics dla `needs entry / below target / discrepancy / requires review`.
  - [x] Rozszerzyć `Results > Reports` o template metadata, scope load i snapshot refresh.
- **DoD**:
  - [x] Operator może wejść `overview -> queue -> catalog -> report` bez gubienia kontekstu.
  - [x] Report artifact pokazuje template/scope i może być odświeżony bez ręcznego rebuildu scope.
  - [x] Rozszerzenie nie narusza granic truth ownership z sekcji 3.

**Delivered artifacts (verified 2026-04-11):**

- **KPI Overview cockpit** (`KpiOverviewView.tsx`):
  - 4 cockpit cards: Governed KPIs / Needs attention / Unresolved reconciliation / On target.
  - Signal spotlight: top 5 KPIs ranked by severity (RED → below → needs entry → no-data).
  - Health breakdown: below target / no fresh signal / needs entry drill-downs.
  - Recent review artifacts from `V8ResultsDashboardSnapshot.recentReviewPacks`.
- **KPI Queue** (`KpiQueueView.tsx` + `KpiSignalSheetView.tsx`):
  - Auto-generated entry sheets per KPI based on cadence (DAILY/WEEKLY/MONTHLY/QUARTERLY).
  - Queue semantics: needs entry / below target / discrepancy / requires review.
  - Manual AI signal sheets via `POST /ai/refine-text` (title, instructions, KPI package).
  - Batch measurement recording across multiple KPIs in `KpiSignalSheetView.tsx`.
- **KPI workspace modes** (`ResultsHub.tsx`):
  - Switchable: Catalog (table/grid) / Data-Signals (queue) / Overview / Scorecards.
  - Watched KPIs (localStorage persistence), lifecycle/signal/owner filters.
- **KPI Reports** (`ResultsKpiReportsView.tsx`):
  - 5 templates: benefits-review, control-pack, portfolio-review, executive-monthly, custom.
  - AI narrative draft via `/ai/refine-text`.
  - Snapshot refresh from report list without manual scope rebuild.
  - Tasks materialization from action plans via `POST /tasks`.
  - Initiative and KPI scope selection with search/select-all.

#### P04-E — Enterprise KPI activation surfaces
- **Goal**: zacząć ujawniać enterprise capabilities, które już mają fundament API/runtime, bez zmiany core doktryny KPI.
- **Acceptance**: `Results` pokazuje pierwsze realne surfaces dla `Schedules / Wallboards / Connectors`, a dokumentacja zamyka scope `MetricDefinition / Goals / Scorecards`.
- **Evidence**: UI runtime for reporting-adjacent surfaces + targeted regression.
- **Tasks**:
  - [x] Rozszerzyć `Results > Reporting` o podpowierzchnie `Reports / Schedules / Wallboards / Connectors`.
  - [x] Pokazać source posture i target KPI scope w tych widokach.
  - [x] Przygotować grunt pod kolejne aktywacje `Goals / Scorecards` i richer metric-definition UX.
- **DoD**:
  - [x] Operator widzi i otwiera powierzchnie dystrybucji bez wychodzenia z modułu `Results`.
  - [x] UI nie tworzy równoległej prawdy; wszystkie surfaces konsumują governed KPI truth.
  - [x] Scope premium jest dopisany do aktualnych źródeł prawdy.

**Delivered artifacts (verified 2026-04-11):**

- **Report Schedules** (`ResultsReportingEnterpriseViews.tsx` + `resultsEnterpriseService.ts`):
  - Create/list/preview schedules with cron cadence, send time, channel (email/Teams/Slack).
  - Audience and recipient management, approval gate, KPI scope selection.
  - Run now + approve actions. Backend: `createReportSchedule`, `approveReportSchedule`, `runReportScheduleNow`.
- **Wallboards** (`ResultsReportingEnterpriseViews.tsx` + `resultsEnterpriseService.ts`):
  - Create/list wallboards with refresh cadence, rotation interval, alert thresholds, KPI scope.
  - Backend: `createWallboard`, `getWallboards`, `createWallboardAlert`, `getWallboardAlerts`.
- **KPI Connectors** (`ResultsReportingEnterpriseViews.tsx` + `resultsEnterpriseService.ts`):
  - Create/list connectors (types: api/csv/database/webhook/manual) with cron cadence.
  - Run now action, ingestion log, KPI scope. Backend: `createConnector`, `ingestKPIValue`, `runConnectorNow`.
- **Goals / Scorecards** (`ResultsKpiScorecardsView.tsx` + `initiativeGovernanceService.ts`):
  - Create goal/objective/key-result/scorecard linked to initiatives.
  - Rollup weighted by child goals and linked initiative progress.
  - Set active / mark done, initiative linking/unlinking.
  - API: `POST/GET /api/initiatives-v4/goals`, `GET .../rollup`, `POST .../initiatives`.
  - Tables: `goals` + `goal_initiative_links` (migration `662_v4_initiatives_tools_enterprise.sql`).

#### P04-F — Full KPI Operator Drawer + Deviation UX
- **Goal**: provide a governed 7-tab KPI workspace drawer covering the full operator lifecycle from inspection through deviation closure and lineage review.
- **Acceptance**: operator can manage a KPI end-to-end from the drawer without navigating away.
- **Evidence**: functional `KPITimeSeriesDrawer.tsx` with all tabs operational.
- **Tasks**:
  - [x] 7-tab drawer: Overview / Definition / Targets / Deviation case / Record / History / Lineage.
  - [x] Full deviation lifecycle: acknowledge → RCA → actions → resolve → close with evidence.
  - [x] Metric audit trail via `resultsEnterpriseService.createMetricAuditEntry`.
  - [x] Chart semantics: projection line, achievement %, period-on-period, target line.
  - [x] Alert semantics: freshness vs cadence, threshold posture, reconciliation vs open case, action ageing.
  - [x] Lineage tab: initiative mappings + KPI connectors (`/results-v4/kpi-connectors`).
- **DoD**:
  - [x] All 7 tabs functional with V8 API + legacy fallback.
  - [x] Deviation case lifecycle E2E: open → acknowledge → RCA → actions → resolve → close.
  - [x] Audit trail entries created on definition/targets/history changes.

**Delivered artifacts:**

- **KPI Drawer** (`KPITimeSeriesDrawer.tsx`):
  - Overview: quick stats (baseline/target/current/gap), expectation stats (phase, realization/post-impl targets, freshness), bar chart with target and projection lines.
  - Definition: read/edit KPI fields (name, description, unit, direction, frequency), audit log for definition changes. Delete KPI capability.
  - Targets: baseline, target, threshold mode (percent/absolute), amber/red thresholds, audit log for target changes.
  - Deviation case: open case display with severity and summary, acknowledge/resolve/close flows, RCA textarea, action plan (add/toggle actions with due dates), evidence-based closure (evidenceText/evidenceRef required).
  - Record: single measurement entry (value, date, source, notes) triggering deviation detection via `handleTimeSeriesRecorded`.
  - History: measurements table + governed target checkpoints + metric audit entries from `kpi_metric_audit_log`.
  - Lineage: initiative link/unlink, connector list filtered to KPI.
- **Backend deviation routes** (`results.routes.ts`):
  - `POST /deviation-cases/:caseId/acknowledge`, `PUT .../rca`, `POST .../actions`, `PUT .../actions/:actionId`, `POST .../resolve`, `POST .../close`.
  - Close requires evidence (evidenceText or evidenceRef), supports linkedInitiativeId and linkedTaskId.

#### P04-G — AI-Assisted KPI Operations
- **Goal**: leverage AI to accelerate KPI operator workflows without replacing human judgment or mutating truth silently.
- **Acceptance**: AI drafts reports and signal sheets; operator reviews and approves.
- **Evidence**: functional AI integration points in reports and queue views.
- **Tasks**:
  - [x] AI report narrative drafts in `ResultsKpiReportsView.tsx` via `POST /ai/refine-text`.
  - [x] AI signal sheet generation in `KpiQueueView.tsx` (title, instructions, required inputs).
  - [x] AI KPI chat context in `ResultsKpisTableV3.tsx` via `openChatWithContext` (entity: kpi).
- **DoD**:
  - [x] AI never silently changes KPI truth (consistent with canon §7).
  - [x] AI output is always draft, requiring operator review before persistence.

**Delivered artifacts:**

- Report title and narrative AI draft (`ResultsKpiReportsView.tsx`): generates report brief from template + scope via `/ai/refine-text`.
- Signal sheet AI draft (`KpiQueueView.tsx`): generates structured JSON (title, instructions, requiredInputs) for KPI data collection.
- KPI chat context (`ResultsKpisTableV3.tsx`): opens AI chat with selected KPI entity context for ad-hoc analysis.

#### P04-H — KPI Attribution + Showcase
- **Goal**: provide initiative-level KPI contribution estimation and a governed demo data layer for empty organizations.
- **Acceptance**: attribution shows weighted contribution per initiative; showcase populates all surfaces when org has no data.
- **Evidence**: functional `kpiAttributionService.ts` + `resultsShowcaseData.ts`.
- **Tasks**:
  - [x] Attribution: `computeAttribution(kpiId, orgId, periodStart, periodEnd)` in `kpiAttributionService.ts`.
  - [x] Weighted contribution via impact_weight × progress × status multiplier.
  - [x] Showcase/demo data across all Results views via `resultsShowcaseData.ts`.
- **DoD**:
  - [x] Attribution returns per-initiative `ContributionEstimate`, unexplained remainder, confidence.
  - [x] Showcase data fills all surfaces (KPIs, initiatives, reports, schedules, wallboards, connectors, goals).

**Delivered artifacts:**

- **Attribution** (`kpiAttributionService.ts`): loads KPI + time series delta, distributes across initiative mappings using heuristic weights, returns estimates + confidence + disclaimer. Routed via `benefits.routes.ts`.
- **Showcase** (`resultsShowcaseData.ts`): demo KPIs, initiatives, reports, schedules, wallboards, connectors, goals. Activated via `shouldUseResultsShowcaseData()` when org data is empty.

### 8.2 Rollout strategy
- Feature-flag / gradual exposure; prefer “read-first” zanim włączymy mutacje szeroko.
- Brak silent scope merge z `Finanse` i `Wdrożenia`.

### 8.3 Rollback plan
- Wyłącz flagi; utrzymaj read access i audit; nie wykonuj destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: KPI stanie się “dashboardem” bez zamkniętej pętli (signal→action).
- Ryzyko: split-truth KPI↔Finance poza zadeklarowanym lane.
- Decyzje: minimalny zakres reconciliation (stany + owner + next action).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P04-A | approved(scope) | 99eb08e9aa | n/a (docs-only) | n/a (docs-only) | KPI canon + scope frozen; no runtime changes in this packet. |
| P04-B | verified(evidence) | (this commit) | 30 tests (15 integration + 6 health posture + 4 permissions + 3 workflow transitions + 1 E2E + 1 checklist) — all green | E2E: signal→inspect→next-action chain; degraded posture for all 4 scenarios; org-health breakdown | Existing 93 ROI service + 20 route tests still green (113 total). |
| P04-C | verified(evidence) | (this commit) | Regression: 113 existing + 30 new = 143 total, 0 failures | Contract checklist 12/12 checked; evidence closeout doc created | Known limits: reconciliation UX depends on Finance module (P05); chart aggregation methods are bounded to last/sum/average. |
| P04-D | verified(evidence) | (this commit) | Cockpit/queue/report regression: Overview cards, queue semantics, 5 templates, snapshot refresh, task materialization — all functional | UI walkthrough: `Overview / Queue / Catalog` + report refresh + batch measurement | Extended visibility and operating ergonomics without changing bounded-lane doctrine. |
| P04-E | verified(evidence) | (this commit) | Enterprise surfaces: schedules/wallboards/connectors CRUD, goals/scorecards API round-trip — all functional | UI walkthrough: `Reports / Schedules / Wallboards / Connectors / Goals` | Enterprise-adjacent Results surfaces with full API + UI. Goals via `initiativeGovernanceService`. |
| P04-F | verified(evidence) | (this commit) | KPI drawer: 7-tab lifecycle, deviation E2E (acknowledge→RCA→actions→resolve→close), metric audit trail — all functional | Drawer walkthrough: all 7 tabs operational with V8 + legacy fallback | Full operator drawer with governed deviation lifecycle and audit. |
| P04-G | verified(evidence) | (this commit) | AI integration: report narrative draft, signal sheet generation, KPI chat context — all functional | AI-assisted flows in reports and queue views | AI accelerates reasoning without mutating truth (canon §7 compliant). |
| P04-H | verified(evidence) | (this commit) | Attribution: `computeAttribution` E2E, showcase data across all surfaces — all functional | Attribution panel + showcase population | Initiative contribution estimation + demo data layer. |

