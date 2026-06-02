---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
scope_anchor: 07_rezultaty/RZ_ROI_ANALYSIS
work_type: docs-only
mode: gap->raw->initiatives->plan->approval
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio-level ROI posture across planned value, realized value and variance by initiative.
- Primary user question: "Gdzie ROI odbiega od planu i co powinno byc nastepna decyzja?"
- Business outcome: one governed ROI analysis lane that supports explicit review decisions without hidden approval semantics.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` renders `ROIAnalysisView`.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `roi_analysis`.
- `ROIAnalysisView` renders portfolio summary, variance chart and initiative drill-in rows.
- `ROIDetailDrawer` supports explicit assumptions and realized-entry review.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI portfolio summaries, initiative-level variance signals, assumptions and realized-entry detail.
- API/service dependencies:
  - `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`, `updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`)
  - bounded fallback to legacy `/benefits/roi/*` compatibility paths.
- Dependency boundary: analysis is advisory; it cannot silently mutate Finance-owned truth.

## 6. Outputs and Side Effects
- Outputs: explainable ROI variance view, recommendation context, explicit next actions.
- Allowed side effects (explicit user action only):
  - assumptions update in detail drawer,
  - realized-entry create in detail drawer.
- Forbidden side effects:
  - hidden approval/finalization,
  - silent write-through to external truth domains.

## 7. Ownership and Handoff Boundaries
- Results owns ROI analysis interpretation in `/benefits`.
- Finance remains owner of finance-model truth and CFO semantics.
- Handoff to reports/execution is advisory until explicit user acceptance.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states are explicit and actionable.
- Degraded state cannot be presented as approved truth.

## 9. AI, Source, Evidence, Approval
- AI actions stay in Menu 3/right command area.
- AI may explain and propose; AI may not silently mutate KPI/ROI truth.
- Every high-impact claim must keep explicit source/provenance posture.
- Approval/lock semantics for ROI analysis remain partially evidenced and are tracked as follow-up.

## 10. Security, Roles, and Tenancy
- Deny-by-default with tenant and ACL boundaries.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| ROI analysis is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions and realized-entry model is explicit and user-triggered. | `/benefits?tab=roi_analysis` | `src/components/Results/ROIDetailDrawer.tsx` | `src/services/api/v8/results.ts` write seams | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit and inspectable in ROI analysis lane. | `/benefits` analysis lane | `src/components/Results/ROIAnalysisView.tsx` | `src/services/api/v8/results.ts` summary/detail reads | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Approval/lock boundary is explicit before approved truth posture. | `/benefits` analysis review flow | review actions exist, explicit approval/lock state not confirmed | no explicit approval endpoint mapped for this lane | no dedicated approval/lock regression | `INCONCLUSIVE` |

## 12. Open Risks and Change Log
- `P0`: none in docs closeout.
- `P1`: explainability quality contract (`source + confidence + rationale`) is not yet normalized as mandatory acceptance.
- `P2`: explicit approval/lock semantics for ROI analysis are not yet evidenced in UI/API/test mapping.

## 13. Task Board Ready Rows (RZ-RAN)
| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component `ResultsHub` + `ROIAnalysisView`; API V8 ROI summary/detail; tests route + ROI suites | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | add direct assertions for explainability quality and no-hidden-approval behavior | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | define approval/lock state contract and evidence checklist | `functions/RZ_ROI_ANALYSIS.md` |

## 14. Full-Cycle Output (A->E)
### A) Gap summary
- P0: evidence baseline lock was required and is completed.
- P1: explainability quality acceptance is incomplete.
- P2: approval/lock evidence is incomplete.

### B) RAW synthesis
- RAW expects: `assumptions -> confidence -> deviation -> explanation -> corrective action -> review -> approval`.
- Current runtime satisfies analysis/deviation baseline but not explicit approval-lock evidence.

### C) Initiatives
- `RZ-RAN-P0-001`, `RZ-RAN-P1-001`, `RZ-RAN-P2-001`.

### D) Unified plan
1. Complete P0 docs lock (done).
2. Unblock P1 prep after P0 sign-off.
3. Start P2 only after P1 criteria are fixed.

### E) Approval and unblock
- Decision: `PASS_WITH_P2`.
- Unblock posture: `UNBLOCK_P1_PREP_ONLY`.

## 15. Gate Verdict
- Function docs closeout verdict: `PASS_WITH_P2`.
- Runtime hardening remains tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
scope_anchor: 07_rezultaty/RZ_ROI_ANALYSIS
work_type: docs-only
mode: gap->raw->initiatives->plan->approval
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio-level ROI posture across planned value, realized value and variance by initiative.
- Primary user question: "Gdzie ROI odbiega od planu i co powinno byc nastepna decyzja?"
- Business outcome: one governed ROI analysis lane that supports explicit review decisions without hidden approval semantics.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` renders `ROIAnalysisView`.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `roi_analysis`.
- `ROIAnalysisView` renders portfolio summary, variance chart and initiative drill-in rows.
- `ROIDetailDrawer` supports explicit assumptions and realized-entry review.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI portfolio summaries, initiative-level variance signals, assumptions and realized-entry detail.
- API/service dependencies:
  - `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`, `updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`)
  - bounded fallback to legacy `/benefits/roi/*` compatibility paths.
- Dependency boundary: analysis is advisory; it cannot silently mutate Finance-owned truth.

## 6. Outputs and Side Effects
- Outputs: explainable ROI variance view, recommendation context, explicit next actions.
- Allowed side effects (explicit user action only):
  - assumptions update in detail drawer,
  - realized-entry create in detail drawer.
- Forbidden side effects:
  - hidden approval/finalization,
  - silent write-through to external truth domains.

## 7. Ownership and Handoff Boundaries
- Results owns ROI analysis interpretation in `/benefits`.
- Finance remains owner of finance-model truth and CFO semantics.
- Handoff to reports/execution is advisory until explicit user acceptance.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states are explicit and actionable.
- Degraded state cannot be presented as approved truth.

## 9. AI, Source, Evidence, Approval
- AI actions stay in Menu 3/right command area.
- AI may explain and propose; AI may not silently mutate KPI/ROI truth.
- Every high-impact claim must keep explicit source/provenance posture.
- Approval/lock semantics for ROI analysis remain partially evidenced and are tracked as follow-up.

## 10. Security, Roles, and Tenancy
- Deny-by-default with tenant and ACL boundaries.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| ROI analysis is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions and realized-entry model is explicit and user-triggered. | `/benefits?tab=roi_analysis` | `src/components/Results/ROIDetailDrawer.tsx` | `src/services/api/v8/results.ts` write seams | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit and inspectable in ROI analysis lane. | `/benefits` analysis lane | `src/components/Results/ROIAnalysisView.tsx` | `src/services/api/v8/results.ts` summary/detail reads | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Approval/lock boundary is explicit before approved truth posture. | `/benefits` analysis review flow | review actions exist, explicit approval/lock state not confirmed | no explicit approval endpoint mapped for this lane | no dedicated approval/lock regression | `INCONCLUSIVE` |

## 12. Open Risks and Change Log
- `P0`: none in docs closeout.
- `P1`: explainability quality contract (`source + confidence + rationale`) is not yet normalized as mandatory acceptance.
- `P2`: explicit approval/lock semantics for ROI analysis are not yet evidenced in UI/API/test mapping.

## 13. Task Board Ready Rows (RZ-RAN)
| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component `ResultsHub` + `ROIAnalysisView`; API V8 ROI summary/detail; tests route + ROI suites | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | add direct assertions for explainability quality and no-hidden-approval behavior | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | define approval/lock state contract and evidence checklist | `functions/RZ_ROI_ANALYSIS.md` |

## 14. Full-Cycle Output (A->E)
### A) Gap summary
- P0: evidence baseline lock was required and is completed.
- P1: explainability quality acceptance is incomplete.
- P2: approval/lock evidence is incomplete.

### B) RAW synthesis
- RAW expects: `assumptions -> confidence -> deviation -> explanation -> corrective action -> review -> approval`.
- Current runtime satisfies analysis/deviation baseline but not explicit approval-lock evidence.

### C) Initiatives
- `RZ-RAN-P0-001`, `RZ-RAN-P1-001`, `RZ-RAN-P2-001`.

### D) Unified plan
1. Complete P0 docs lock (done).
2. Unblock P1 prep after P0 sign-off.
3. Start P2 only after P1 criteria are fixed.

### E) Approval and unblock
- Decision: `PASS_WITH_P2`.
- Unblock posture: `UNBLOCK_P1_PREP_ONLY`.

## 15. Gate Verdict
- Function docs closeout verdict: `PASS_WITH_P2`.
- Runtime hardening remains tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
scope_anchor: 07_rezultaty/RZ_ROI_ANALYSIS
work_type: docs-only
mode: gap->raw->initiatives->plan->approval
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio ROI posture across assumptions, variance, and realized value.
- Business outcome: one governed ROI analysis lane that supports decisions without hidden writes or silent approvals.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` branch renders `ROIAnalysisView`.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `roi_analysis`.
- `ROIAnalysisView` shows portfolio variance, status posture, and initiative drill-in.
- `ROIDetailDrawer` enables explicit assumptions and realized-entry actions.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - portfolio summary (`totalProjected`, `totalRealized`, `totalVariance`),
  - initiative-level ROI signals (`projectedBenefit`, `realizedBenefit`, `variance`, confidence),
  - assumptions and realized entries from detail flow.
- API/service dependencies:
  - `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`, `updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`),
  - bounded legacy fallback on `/benefits/roi/*` compatibility paths.

## 6. Outputs and Side Effects
- Outputs: variance-ranked analysis view, explainability context, explicit next actions.
- Allowed side effects: explicit assumptions update and realized-entry creation.
- Forbidden side effects: hidden approval/finalization, silent truth mutation.

## 7. Ownership and Handoff Boundaries
- Results owns ROI analysis interpretation and review surfaces.
- Finance ownership of finance-model truth remains intact.
- Handoff to reports/execution remains explicit and user-controlled.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states must be explicit.
- Degraded data cannot be presented as approved truth.

## 9. AI, Source, Evidence, Approval
- AI actions remain in Menu 3/right command placement.
- AI may explain and propose; AI may not mutate KPI/ROI truth silently.
- Source/evidence/provenance visibility is required for critical claims.
- Approval semantics are only partially evidenced in current lane (`INCONCLUSIVE` for explicit approval-lock state).

## 10. Security, Roles, and Tenancy
- Deny-by-default with tenant/ACL boundaries.

## 11. Evidence Matrix (route + component + API + test)
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| ROI analysis is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`roi_analysis` branch) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions model is explicit and user-triggered. | `/benefits?tab=roi_analysis` | `src/components/Results/ROIDetailDrawer.tsx` | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`) + legacy fallback path | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit and inspectable. | `/benefits` ROI analysis lane | `src/components/Results/ROIAnalysisView.tsx`, `src/components/Results/ROIDetailDrawer.tsx` | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Review/approval boundary is explicit before approved truth posture. | ROI analysis review flow in `/benefits` | review actions exist, explicit approval/lock state not confirmed | no dedicated approval endpoint mapped for lane | no dedicated approval/lock regression | `INCONCLUSIVE` |

## 12. Full-Cycle Output

### A) Gap summary
- `P0`: baseline evidence lock required and now completed.
- `P1`: explainability quality contract not yet normalized (`source + confidence + rationale` as mandatory acceptance).
- `P2`: explicit approval-lock semantics not yet evidenced.

### B) RAW target analysis
- RAW expects loop: `assumptions -> confidence -> deviation -> explanation -> corrective action -> review -> approval`.
- RAW requires pending approvals and missing evidence to remain explicit and actionable.

### C) Initiatives backlog
| Task ID | Priority | Goal | Status |
| --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `P0` | lock full-cycle docs baseline and evidence matrix | `READY` |
| `RZ-RAN-P1-001` | `P1` | uplift explainability quality contract | `WAITING_P0` |
| `RZ-RAN-P2-001` | `P2` | harden explicit approval/lock semantics | `WAITING_P0` |

### D) Unified plan
1. Complete `RZ-RAN-P0-001` (done in docs scope).
2. Unblock `RZ-RAN-P1-001` prep after P0 sign-off.
3. Execute `RZ-RAN-P2-001` only after P1 contract closure.

Risks:
- lack of explicit approval-state control in lane,
- inconsistent explainability quality across critical insights.

### E) Approval and unblock
- Decision: `PASS_WITH_P2`.
- Unblock: `UNBLOCK_P1_PREP_ONLY`.
- Hard stop: runtime go for approval semantics stays blocked while approval claim remains `INCONCLUSIVE`.

## 13. Gate Verdict
- Function docs closeout: `PASS_WITH_P2`.
- Follow-up remains tracked in `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
- Work type for this closeout: `docs-only`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio ROI patterns and variance drivers from trusted evidence.
- Business outcome: one analysis lane for ROI insights that does not silently mutate ROI truth.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` is a valid runtime branch in `ResultsHub`.

## 4. UI Component Footprint
- ROI analysis branch in `ResultsHub`.
- `ROIAnalysisView` provides insight surfaces and recommendation context.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI summaries, variance signals, KPI/initiative references.
- API/service evidence: `src/services/api/v8/results.ts` (summary reads), bounded fallback in `src/services/api.ts`.
- Dependency boundary: analysis uses ROI tracking outputs but remains advisory.

## 6. Outputs and Side Effects
- Outputs: insight narratives, variance breakdowns and explicit recommendation prompts.
- Side effects: no hidden writes; downstream actions remain explicit user decisions.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns ROI analysis interpretation.
- `08_finanse` owns model/valuation truth.
- Handoffs to reports/execution are advisory until explicit acceptance.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states are explicit and actionable.

## 9. AI, Source, Evidence, Approval
- AI actions remain in Menu 3/right command placement.
- AI may explain and propose but cannot silently mutate KPI/ROI truth.
- Every analysis claim must retain source/provenance posture.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_ROI_ANALYSIS` is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`activeTab === 'roi_analysis'`) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| ROI analysis workspace is a dedicated runtime branch. | `/benefits` route shell | `ROIAnalysisView` branch in Results runtime | `src/services/api/v8/results.ts` portfolio summaries | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx` | `PASS` |
| Analysis lane remains advisory with no hidden write path. | `/benefits?tab=roi_analysis` | read-first analysis surfaces | governed read contracts in V8 client | no dedicated automated assertion for no-hidden-write branch | `PASS_WITH_P2` |

## 12. Open Risks and Change Log
- `P0`: none in docs closeout.
- `P1`: dedicated regression for source/provenance visibility in ROI analysis lane is missing.
- `P2`: degraded-state and confidence signaling evidence depth remains partial.

## 13. Task Board Ready Rows (RZ-RAN)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component ROI analysis branch; API V8 summaries; tests routeMapping + ROI views | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | add direct assertions for source/provenance and no-hidden-write posture | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | enrich degraded-state and confidence/evidence signaling references | `functions/RZ_ROI_ANALYSIS.md` |

## 14. Gate Verdict
- Function docs closeout verdict: `APPROVED_FOR_DOCS`.
- Runtime hardening is tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/07_rezultaty/03_BEHAVIOR.md`
  - `docs/modules/07_rezultaty/04_UI_UX.md`
  - `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/RESULTS_V8_SSOT.md`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio-level ROI posture across planned value, realized value and variance by initiative.
- Primary user question: "Gdzie ROI odbiega od planu i czy assumptions sa nadal wiarygodne?"
- Business outcome: one governed ROI analysis lane that links assumptions and deviations to explicit review actions, without hidden approvals.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` is a valid runtime branch and renders `ROIAnalysisView`.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `roi_analysis`.
- `ROIAnalysisView` renders portfolio summary, variance chart and initiative table for analysis.
- `ROIDetailDrawer` is opened from ROI analysis row actions (`open`, `record`, `history`) and carries assumptions + realized-entry forms.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - portfolio summary (`totalProjected`, `totalRealized`, `totalVariance`),
  - per-initiative ROI records (`projectedBenefit`, `realizedBenefit`, `variance`, `confidence`, owner),
  - initiative-level assumptions and realized entries exposed through detail drawer.
- API/service dependencies:
  - `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`, `updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`),
  - bounded fallback to legacy `/benefits/roi/*` routes only for compatibility statuses.

## 6. Outputs and Side Effects
- Output artifacts: variance-ranked ROI list, anomaly highlights, detail drill-in with assumptions and realized history.
- Allowed side effects (explicit user action only):
  - assumptions update from `ROIDetailDrawer`,
  - realized entry create from `ROIDetailDrawer`,
  - refresh read-back after save.
- Forbidden side effects:
  - hidden approval/finalization of ROI truth,
  - silent write-through from AI or passive analysis rendering.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns ROI analysis interpretation surface and variance navigation.
- ROI truth remains governed by Results contracts; external modules may consume but not override this lane semantics.
- Handoff to approvals/reports must stay explicit and user-controlled.

## 8. Runtime States and UX Behavior
- Loading: ROI analysis shows explicit loading state before rendering metrics.
- Empty: no ROI item set shows explicit empty-state message.
- Error/degraded: V8-first data path with bounded legacy fallback; failures do not fabricate success state.
- Success: variance summary, status badges and row actions stay interactive with detail drill-in.

## 9. AI, Source, Evidence, Approval
- AI actions for ROI reasoning must stay in Menu 3/right-side placement and must not duplicate in canvas.
- Source/evidence posture:
  - ROI analysis reads governed V8 contracts first,
  - fallback paths are compatibility-only and auditable in tests.
- Review/approval model for this function:
  - review action surface exists (open detail, inspect variance, update assumptions, record realized),
  - explicit approval/lock semantic is not evidenced in current `roi_analysis` surface and remains a follow-up gap (`INCONCLUSIVE`).

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_ROI_ANALYSIS` is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}`) | `src/components/Results/ResultsHub.tsx` (`roi_analysis` tab and branch -> `ROIAnalysisView`) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions + realized-entry model is explicit and write paths are governed. | user action path in `/benefits?tab=roi_analysis` via detail drawer | `src/components/Results/ROIDetailDrawer.tsx` (assumptions editor + realized entry submit) | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`) with bounded legacy `/benefits/roi/:id/*` fallback | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit (variance summary, status, initiative-level variance sorting). | `/benefits` ROI analysis lane | `src/components/Results/ROIAnalysisView.tsx` (`variance` aggregation, `deriveROIStatus`, variance chart/table) | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Review/approval boundary is explicit and auditable before presenting approved ROI truth. | `/benefits` ROI analysis workflow | row actions for review/drill-in are explicit, but no dedicated approval/lock UI contract found in `ROIAnalysisView`/`ROIDetailDrawer` | no explicit approval endpoint evidence mapped for this lane | no dedicated automated assertion for ROI approval/lock semantics | `INCONCLUSIVE` |

## 12. As-Is -> Delta

### As-Is
- ROI analysis lane is active in `ResultsHub` and renders `ROIAnalysisView`.
- V8-first ROI portfolio/detail reads and ROI assumptions/realized writes are present with bounded fallback paths.
- Tests confirm V8-first + bounded fallback behavior for ROI analysis/detail paths.

### Delta Closed In This Pass
- Locked function contract to immutable scope anchor `07_rezultaty/RZ_ROI_ANALYSIS`.
- Added mandatory `route + component + API + test` evidence matrix for assumptions/deviations/review-approval claims.
- Marked review/approval approval-lock gap explicitly as `INCONCLUSIVE` (no guessing, no silent pass).

## 13. Task Board Ready Rows (RZ-RAN)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component `ResultsHub` + `ROIAnalysisView` + `ROIDetailDrawer`; API V8 ROI summary/detail/assumptions/realized; tests ROI views + ROI drawer suites | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | dedicated regression for explicit review->approval boundary and no-hidden-approval rule in ROI analysis lane | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | deeper evidence for source/provenance badge model and manual approval checklist alignment | `functions/RZ_ROI_ANALYSIS.md` |

## 14. Open Risks, Findings, Open Questions

### Findings (P0/P1/P2)
- `P0`: none in docs closeout.
- `P1`: none that block docs publication.
- `P2`: explicit approval/lock semantics for ROI analysis are not yet evidenced in current UI/API/test mapping.

### Open Questions (max 3)
1. Which concrete UI state should represent approved ROI claim (`approved`, `locked`, or equivalent) in `roi_analysis` lane?
2. Should approval ownership live in Results only, or be delegated to a cross-module review object while preserving Results truth ownership?

## 15. Gate Verdict

- Function docs closeout verdict: `PASS_WITH_P2`.
- Runtime hardening remains tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/07_rezultaty/03_BEHAVIOR.md`
  - `docs/modules/07_rezultaty/04_UI_UX.md`
  - `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/RESULTS_V8_SSOT.md`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio-level ROI posture across planned value, realized value and variance by initiative.
- Primary user question: "Gdzie ROI odbiega od planu i czy assumptions sa nadal wiarygodne?"
- Business outcome: one governed ROI analysis lane that links assumptions and deviations to explicit review actions, without hidden approvals.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` is a valid runtime branch and renders `ROIAnalysisView`.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `roi_analysis`.
- `ROIAnalysisView` renders portfolio summary, variance chart and initiative table for analysis.
- `ROIDetailDrawer` is opened from ROI analysis row actions (`open`, `record`, `history`) and carries assumptions + realized-entry forms.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - portfolio summary (`totalProjected`, `totalRealized`, `totalVariance`),
  - per-initiative ROI records (`projectedBenefit`, `realizedBenefit`, `variance`, `confidence`, owner),
  - initiative-level assumptions and realized entries exposed through detail drawer.
- API/service dependencies:
  - `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`, `updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`),
  - bounded fallback to legacy `/benefits/roi/*` routes only for compatibility statuses.

## 6. Outputs and Side Effects
- Output artifacts: variance-ranked ROI list, anomaly highlights, detail drill-in with assumptions and realized history.
- Allowed side effects (explicit user action only):
  - assumptions update from `ROIDetailDrawer`,
  - realized entry create from `ROIDetailDrawer`,
  - refresh read-back after save.
- Forbidden side effects:
  - hidden approval/finalization of ROI truth,
  - silent write-through from AI or passive analysis rendering.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns ROI analysis interpretation surface and variance navigation.
- ROI truth remains governed by Results contracts; external modules may consume but not override this lane semantics.
- Handoff to approvals/reports must stay explicit and user-controlled.

## 8. Runtime States and UX Behavior
- Loading: ROI analysis shows explicit loading state before rendering metrics.
- Empty: no ROI item set shows explicit empty-state message.
- Error/degraded: V8-first data path with bounded legacy fallback; failures do not fabricate success state.
- Success: variance summary, status badges and row actions stay interactive with detail drill-in.

## 9. AI, Source, Evidence, Approval
- AI actions for ROI reasoning must stay in Menu 3/right-side placement and must not duplicate in canvas.
- Source/evidence posture:
  - ROI analysis reads governed V8 contracts first,
  - fallback paths are compatibility-only and auditable in tests.
- Review/approval model for this function:
  - review action surface exists (open detail, inspect variance, update assumptions, record realized),
  - explicit approval/lock semantic is not evidenced in current `roi_analysis` surface and remains a follow-up gap (`INCONCLUSIVE`).

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_ROI_ANALYSIS` is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}`) | `src/components/Results/ResultsHub.tsx` (`roi_analysis` tab and branch -> `ROIAnalysisView`) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions + realized-entry model is explicit and write paths are governed. | user action path in `/benefits?tab=roi_analysis` via detail drawer | `src/components/Results/ROIDetailDrawer.tsx` (assumptions editor + realized entry submit) | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`) with bounded legacy `/benefits/roi/:id/*` fallback | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit (variance summary, status, initiative-level variance sorting). | `/benefits` ROI analysis lane | `src/components/Results/ROIAnalysisView.tsx` (`variance` aggregation, `deriveROIStatus`, variance chart/table) | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Review/approval boundary is explicit and auditable before presenting approved ROI truth. | `/benefits` ROI analysis workflow | row actions for review/drill-in are explicit, but no dedicated approval/lock UI contract found in `ROIAnalysisView`/`ROIDetailDrawer` | no explicit approval endpoint evidence mapped for this lane | no dedicated automated assertion for ROI approval/lock semantics | `INCONCLUSIVE` |

## 12. As-Is -> Delta

### As-Is
- ROI analysis lane is active in `ResultsHub` and renders `ROIAnalysisView`.
- V8-first ROI portfolio/detail reads and ROI assumptions/realized writes are present with bounded fallback paths.
- Tests confirm V8-first + bounded fallback behavior for ROI analysis/detail paths.

### Delta Closed In This Pass
- Locked function contract to immutable scope anchor `07_rezultaty/RZ_ROI_ANALYSIS`.
- Added mandatory `route + component + API + test` evidence matrix for assumptions/deviations/review-approval claims.
- Marked review/approval approval-lock gap explicitly as `INCONCLUSIVE` (no guessing, no silent pass).

## 13. Task Board Ready Rows (RZ-RAN)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component `ResultsHub` + `ROIAnalysisView` + `ROIDetailDrawer`; API V8 ROI summary/detail/assumptions/realized; tests ROI views + ROI drawer suites | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | dedicated regression for explicit review->approval boundary and no-hidden-approval rule in ROI analysis lane | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | deeper evidence for source/provenance badge model and manual approval checklist alignment | `functions/RZ_ROI_ANALYSIS.md` |

## 14. Open Risks, Findings, Open Questions

### Findings (P0/P1/P2)
- `P0`: none in docs closeout.
- `P1`: none that block docs publication.
- `P2`: explicit approval/lock semantics for ROI analysis are not yet evidenced in current UI/API/test mapping.

### Open Questions (max 3)
1. Which concrete UI state should represent approved ROI claim (`approved`, `locked`, or equivalent) in `roi_analysis` lane?
2. Should approval ownership live in Results only, or be delegated to a cross-module review object while preserving Results truth ownership?

## 15. Gate Verdict

- Function docs closeout verdict: `PASS_WITH_P2`.
- Runtime hardening remains tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
- Work type for this closeout: `docs-only`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio ROI patterns, explain variance and propose next actions from trusted evidence.
- Primary user question: "Gdzie ROI odbiega od oczekiwan i co powinno byc nastepna decyzja?"
- Business outcome: one analysis lane for ROI insights that does not silently mutate ROI truth.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` is a valid runtime branch in `ResultsHub`.

## 4. UI Component Footprint
- ROI analysis workspace is rendered by `ResultsHub` when `activeTab === 'roi_analysis'`.
- `ROIAnalysisView` provides portfolio insight surfaces and recommendation context.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI portfolio summaries, variance signals, KPI and initiative context references.
- API/service evidence:
  - `src/services/api/v8/results.ts` for governed results summaries,
  - compatibility read seam in `src/services/api.ts` when bounded fallback applies.
- Dependency notes: consumes ROI tracking outputs but must not bypass source provenance.

## 6. Outputs and Side Effects
- Outputs: insight narratives, variance breakdowns and explicit recommendation prompts.
- Side effects:
  - analysis is read-first and recommendation-oriented,
  - any downstream write/handoff remains explicit and user-confirmed,
  - no hidden finalization or approval branch is allowed.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns ROI analysis interpretation in Results runtime.
- `08_finanse` remains owner for financial model truth and accounting decisions.
- Handoffs to reports or execution are advisory until explicit user acceptance.

## 8. Runtime States and UX Behavior
- Loading: analysis lane exposes loading/source-state posture.
- Empty: empty-analysis state is explicit when source data is missing.
- Error: failed analysis reads surface actionable error feedback.
- Degraded: partial/incomplete context is marked and not promoted to approved insight.
- Success: analysis conclusions include provenance and next-action guidance.

## 9. AI, Source, Evidence, Approval
- AI actions remain in Menu 3/right command placement.
- AI may explain and propose but cannot silently mutate KPI/ROI truth.
- Every analysis claim must retain source/provenance posture and confidence/evidence context.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_ROI_ANALYSIS` is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`activeTab === 'roi_analysis'`) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| ROI analysis workspace is rendered as a dedicated branch in Results runtime. | `/benefits` route shell | `ResultsHub.tsx` ROI analysis branch + `ROIAnalysisView` | `src/services/api/v8/results.ts` portfolio summary contracts | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx` | `PASS` |
| Analysis lane keeps explicit source/provenance posture and no hidden write path. | `/benefits?tab=roi_analysis` | analysis view/read-only posture in ROI analysis surfaces | governed read contracts in V8 results client | no dedicated regression asserting "no hidden write" branch | `PASS_WITH_P2` |
| Degraded analysis context is not presented as final truth. | `/benefits` analysis lane | degraded/source-state handling in runtime | V8-first + bounded fallback behavior | dedicated degraded-state e2e assertion not found | `PASS_WITH_P2` |

## 12. Task Board Ready Rows (RZ-RAN)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component ROI analysis branch; API V8 results summaries; tests routeMapping + ROI views | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | add dedicated assertions for source/provenance visibility and no-hidden-write posture in analysis lane | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | enrich degraded-state and confidence/evidence signaling references for analysis outputs | `functions/RZ_ROI_ANALYSIS.md` |

## 13. Open Risks and Findings

- `P0`: none in docs closeout.
- `P1`: dedicated regression for source/provenance visibility in ROI analysis lane is missing.
- `P2`: degraded-state and confidence signaling evidence depth remains partial.

## 14. Gate Verdict

- Function docs closeout verdict: `APPROVED_FOR_DOCS`.
- Runtime hardening is tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
function_name: Results — ROI Analysis
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — ROI Analysis

## 1. Function Identity
- Function ID: `RZ_ROI_ANALYSIS`
- Runtime anchor: `ResultsHub` tab `roi_analysis`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/07_rezultaty/03_BEHAVIOR.md`
  - `docs/modules/07_rezultaty/04_UI_UX.md`
  - `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/RESULTS_V8_SSOT.md`

## 2. User Job and Business Outcome
- Purpose: analyze portfolio-level ROI posture across planned value, realized value and variance by initiative.
- Primary user question: "Gdzie ROI odbiega od planu i czy assumptions sa nadal wiarygodne?"
- Business outcome: one governed ROI analysis lane that links assumptions and deviations to explicit review actions, without hidden approvals.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi_analysis` is a valid runtime branch and renders `ROIAnalysisView`.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `roi_analysis`.
- `ROIAnalysisView` renders portfolio summary, variance chart and initiative table for analysis.
- `ROIDetailDrawer` is opened from ROI analysis row actions (`open`, `record`, `history`) and carries assumptions + realized-entry forms.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - portfolio summary (`totalProjected`, `totalRealized`, `totalVariance`),
  - per-initiative ROI records (`projectedBenefit`, `realizedBenefit`, `variance`, `confidence`, owner),
  - initiative-level assumptions and realized entries exposed through detail drawer.
- API/service dependencies:
  - `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`, `updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`),
  - bounded fallback to legacy `/benefits/roi/*` routes only for compatibility statuses.

## 6. Outputs and Side Effects
- Output artifacts: variance-ranked ROI list, anomaly highlights, detail drill-in with assumptions and realized history.
- Allowed side effects (explicit user action only):
  - assumptions update from `ROIDetailDrawer`,
  - realized entry create from `ROIDetailDrawer`,
  - refresh read-back after save.
- Forbidden side effects:
  - hidden approval/finalization of ROI truth,
  - silent write-through from AI or passive analysis rendering.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns ROI analysis interpretation surface and variance navigation.
- ROI truth remains governed by Results contracts; external modules may consume but not override this lane semantics.
- Handoff to approvals/reports must stay explicit and user-controlled.

## 8. Runtime States and UX Behavior
- Loading: ROI analysis shows explicit loading state before rendering metrics.
- Empty: no ROI item set shows explicit empty-state message.
- Error/degraded: V8-first data path with bounded legacy fallback; failures do not fabricate success state.
- Success: variance summary, status badges and row actions stay interactive with detail drill-in.

## 9. AI, Source, Evidence, Approval
- AI actions for ROI reasoning must stay in Menu 3/right-side placement and must not duplicate in canvas.
- Source/evidence posture:
  - ROI analysis reads governed V8 contracts first,
  - fallback paths are compatibility-only and auditable in tests.
- Review/approval model for this function:
  - review action surface exists (open detail, inspect variance, update assumptions, record realized),
  - explicit approval/lock semantic is not evidenced in current `roi_analysis` surface and remains a follow-up gap (`INCONCLUSIVE`).

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_ROI_ANALYSIS` is anchored in `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}`) | `src/components/Results/ResultsHub.tsx` (`roi_analysis` tab and branch -> `ROIAnalysisView`) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions + realized-entry model is explicit and write paths are governed. | user action path in `/benefits?tab=roi_analysis` via detail drawer | `src/components/Results/ROIDetailDrawer.tsx` (assumptions editor + realized entry submit) | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`) with bounded legacy `/benefits/roi/:id/*` fallback | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit (variance summary, status, initiative-level variance sorting). | `/benefits` ROI analysis lane | `src/components/Results/ROIAnalysisView.tsx` (`variance` aggregation, `deriveROIStatus`, variance chart/table) | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Review/approval boundary is explicit and auditable before presenting approved ROI truth. | `/benefits` ROI analysis workflow | row actions for review/drill-in are explicit, but no dedicated approval/lock UI contract found in `ROIAnalysisView`/`ROIDetailDrawer` | no explicit approval endpoint evidence mapped for this lane | no dedicated automated assertion for ROI approval/lock semantics | `INCONCLUSIVE` |

## 12. As-Is -> Delta

### As-Is
- ROI analysis lane is active in `ResultsHub` and renders `ROIAnalysisView`.
- V8-first ROI portfolio/detail reads and ROI assumptions/realized writes are present with bounded fallback paths.
- Tests confirm V8-first + bounded fallback behavior for ROI analysis/detail paths.

### Delta Closed In This Pass
- Locked function contract to immutable scope anchor `07_rezultaty/RZ_ROI_ANALYSIS`.
- Added mandatory `route + component + API + test` evidence matrix for assumptions/deviations/review-approval claims.
- Marked review/approval approval-lock gap explicitly as `INCONCLUSIVE` (no guessing, no silent pass).

## 13. Task Board Ready Rows (RZ-RAN)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component `ResultsHub` + `ROIAnalysisView` + `ROIDetailDrawer`; API V8 ROI summary/detail/assumptions/realized; tests ROI views + ROI drawer suites | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | `test/docs` | `RZ-RAN-P0-001` | dedicated regression for explicit review->approval boundary and no-hidden-approval rule in ROI analysis lane | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | `docs` | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | deeper evidence for source/provenance badge model and manual approval checklist alignment | `functions/RZ_ROI_ANALYSIS.md` |

## 14. Open Risks, Findings, Open Questions

### Findings (P0/P1/P2)
- `P0`: none in docs closeout.
- `P1`: none that block docs publication.
- `P2`: explicit approval/lock semantics for ROI analysis are not yet evidenced in current UI/API/test mapping.

### Open Questions (max 3)
1. Which concrete UI state should represent approved ROI claim (`approved`, `locked`, or equivalent) in `roi_analysis` lane?
2. Should approval ownership live in Results only, or be delegated to a cross-module review object while preserving Results truth ownership?

## 15. Gate Verdict

- Function docs closeout verdict: `PASS_WITH_P2`.
- Runtime hardening remains tracked by `RZ-RAN-P1-001` and `RZ-RAN-P2-001`.
