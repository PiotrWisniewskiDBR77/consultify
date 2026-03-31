# Final Implementation Contract — KPI (Position 4/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `verified(evidence)` — P04-A/B/C all closed  
Last updated: 2026-03-31 (P04-C evidence closure)

## 1. Executive summary
- **Intent**: KPI są dobrze opisane — teraz trzeba je dobrze zbudować.
- **Primary users**: operatorzy wyników (management/PMO/owner).
- **Success metric**: KPI to nie „dashboard” tylko lane: signal → report/reconciliation → next action, spójne z konsekwencjami finansowymi.

## 2. Scope
### 2.1 In-scope
- KPI inspection + report workflow + reconciliation semantics.
- KPI ↔ finanse: konsekwencje i spójność runtime na deklarowanych ścieżkach.

### 2.2 Out-of-scope / non-goals
- Pełny BI suite (Looker/Tableau parity).
- “Wykresy bez zamknięcia pętli” (to jest anty-cel; KPI ma kończyć się decyzją i akcją).
- Zastąpienie modułu `Finanse` i `Wdrożenia` (KPI ma je zasilać i linkować, nie przejmować).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`
- SSOT: `docs/product/RESULTS_V8_SSOT.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

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

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md` + linkage SSOT.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Closed-loop workflows | KPI must lead to report + reconciliation | “report workflows are too narrow” | Rozszerzyć report workflow: stany, guidance, readback, wynik | P0 |
| Reconciliation semantics | explicit discrepancy handling | “reconciliation depth is limited” | Zdefiniować i dowieźć reconciliation (aligned/pending/requires review) + evidence cues | P0 |
| KPI↔Finance coherence | consequence lane must be coherent | “still not fully unified outside active lane” | Domknąć KPI→Finance runtime unification na deklarowanym zakresie | P0 |
| KPI as operating system (not only dashboard) | scorecard + commentary + next action | “behaves more like bounded dashboard” | Wymusić “next action” flows (execution follow-up) i status tracking | P1

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

##### 8.1G Acceptance checklist (scope approval, testable)
- [x] Vocabulary is frozen and used consistently → `kpiWorkflowCanon.ts`: `KpiSignal`, `KpiTarget`, `KpiTrend`, `KpiReport`, `KpiReconciliation`, `KpiNextAction`.
- [x] KPI is closed-loop lane, not BI suite → `KPI_ANTI_DUPLICATE_RULES.no_bi_suite_drift`.
- [x] KPI truth vs finance model truth boundary explicit → `KpiFinanceLinkMetadata` + `LINKAGE_PATTERNS` + W6-5 ownership.
- [x] Linkage optional, supports interpretation/driver/review/realization → `LINKAGE_PATTERNS`.
- [x] Reconciliation ownership frozen → `initiateReconciliation()` (Results) + `resolveReconciliation()` (Finance).
- [x] Permissions frozen → `KPI_PERMISSION_MATRIX` + `canPerformKpiAction()`.
- [x] “Permission denied” has explicit degraded posture → `computeKpiHealthPosture()` returns `permission_denied`.
- [x] “Missing data” has explicit degraded posture → `computeKpiHealthPosture()` returns `missing_data`; `/workflow/kpi/:kpiId/health`.
- [x] “Discrepancy unresolved” has explicit degraded posture → `computeKpiHealthPosture()` returns `discrepancy_unresolved`.
- [x] “Linkage unavailable” has explicit degraded posture → `computeKpiHealthPosture()` returns `linkage_unavailable`.
- [x] Anti-duplicate gates explicit → `KPI_ANTI_DUPLICATE_RULES` (4 rules) + `/workflow/contract`.
- [x] Canonical workflow explicit → `KPI_WORKFLOW_STATES` + `KPI_WORKFLOW_TRANSITIONS` + 6 workflow endpoints.

#### P04-B — Core workflow closure (signal→report→reconciliation→action)
- **Goal**: domknąć workflow i stany (w deklarowanym zakresie).
- **Acceptance**: user przechodzi E2E bez “domyślania”; nie ma split-truth na KPI↔Finance.
- **Evidence**: testy integracyjne linkage + staging demo “discrepancy”.
- **Tasks**:
  - Implement the E2E KPI workflow states and transitions (bounded).
  - Implement KPI→Finance consequence and ensure no split-truth.
  - Add integration + workflow regression tests (6.2).
- **Staging proof script (click-by-click)**:
  1. Open `KPI` and locate a KPI with a discrepancy signal (or create one in staging data).
  2. Enter the report/scorecard flow and confirm states + “next action” are explicit.
  3. Start reconciliation and set/observe reconciliation state transitions (bounded).
  4. Drill down into finance consequence and confirm linkage is consistent (no split-truth).
  5. Create/trigger an execution follow-up and verify context is preserved.
  6. Repeat with a “targets” scenario: set a target → view target vs actual → attach comment/plan (bounded).
- **DoD**:
  - “Discrepancy” demo passes; tests pass; next action is always explicit.

#### P04-C — Verification + rollout
- **Goal**: dopiąć telemetry, regresje i staging proof; przygotować bezpieczny rollout/rollback.
- **Acceptance**: wszystko spełnia bar `verified(evidence)` z playbooka.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proofs (6.3) and fill evidence ledger rows P04-A/B/C.
  - Validate rollout/rollback (read-first posture; flags).
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

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

