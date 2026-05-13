---
module_id: MODULE_RESULTS
function_id: RZ_ROI_TRACKING
function_name: Results — ROI Tracking
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — ROI Tracking

## 1. Function Identity
- Function ID: `RZ_ROI_TRACKING`
- Runtime anchor: `ResultsHub` tab `roi`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_ROI_TRACKING`
- Work type for this closeout: `docs-only`

## 2. User Job and Business Outcome
- Purpose: track ROI assumptions against realized value over time with explicit variance and evidence posture.
- Primary user question: "Czy realizacja ROI jest zgodna z zalozeniami i czy odchylenia sa rozliczalne?"
- Business outcome: one governed ROI tracking lane in Results without creating a second Finance truth.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=roi` is a valid runtime branch in `ResultsHub`.

## 4. UI Component Footprint
- ROI tracking workspace is rendered when `activeTab === 'roi'`.
- ROI detail interactions are served by ROI drawers and detail panels.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: ROI assumptions, realized values, variance deltas and linked KPI/initiative context.
- API/service evidence: `src/services/api/v8/results.ts` (V8 ROI summary/read-write seams), bounded fallback in `src/services/api.ts`.
- Dependency boundary: Finance interpretation can be linked as evidence but remains outside this function ownership.

## 6. Outputs and Side Effects
- Outputs: ROI tracking rows, variance indicators, assumptions updates and reconciliation guidance.
- Side effects: explicit user-triggered writes, explicit refresh/read-back, visible feedback.
- Forbidden side effects:
  - hidden write to Finance-owned model truth,
  - silent overwrite of Results ROI truth by Finance interpretation,
  - hidden approval/finalization side effects.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns ROI tracking interpretation and presentation.
- `08_finanse` owns finance model truth and accounting semantics.
- Handoff rule: Results sends linked evidence/reconciliation context; Finance returns interpretation context only.
- Hidden cross-module writes are forbidden.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states are explicit and actionable.

## 9. AI, Source, Evidence, Approval
- AI actions remain in Menu 3/right-side command placement.
- ROI claims must expose source/provenance and assumptions posture.
- High-impact ROI updates require explicit user action and review posture.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_ROI_TRACKING` is anchored in `/benefits` tab `roi`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`VALID_TABS`, `activeTab === 'roi'`) | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| ROI tracking lane renders dedicated ROI surfaces. | `/benefits` route shell | ROI tracking branch in `ResultsHub`, `ROITrackingView`, `ROIOpenModal` | `src/services/api/v8/results.ts` ROI summary/detail reads | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx` | `PASS` |
| ROI detail writes are explicit and read-back aligned. | `/benefits?tab=roi` user flow | `ROIDetailDrawer` interactions | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`) | `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Results vs Finance ownership boundary is explicit; hidden cross-domain write is forbidden. | ROI remains in Results route domain (`/benefits`) | ROI components live under Results runtime only | linkage doctrine in `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | no dedicated automated test proving "no direct write to Finance-owned objects" | `PASS_WITH_P2` |

## 12. Open Risks and Change Log
- `P0`: none in docs closeout.
- `P1`: read-back/degraded variance assertion depth remains partial.
- `P2`: dedicated automated proof for no Results->Finance ownership-leak write remains missing.

## 12A. Gap Summary (A)

| Gap area | As-is finding | Priority | Task binding |
| --- | --- | --- | --- |
| Ownership boundaries | Contract rule exists, but missing dedicated automated guard against Results -> Finance write leak. | `P2` | `RZ-ROI-P2-001` |
| Assumptions governance | Assumptions writes are explicit, but deeper lineage requirements per source type are not yet codified in one matrix. | `P2` | `RZ-ROI-P2-001` |
| Read-back certainty | Write seams are covered, but explicit post-write read-back scenario depth is still limited to component tests. | `P1` | `RZ-ROI-P1-001` |
| Variance handling | Variance visibility exists, but degraded/compatibility variance posture lacks dedicated end-to-end assertion. | `P1` | `RZ-ROI-P1-001` |

## 12B. RAW Delta Summary (B)

- RAW target (`RAW_INPUT.md` + `RESULTS_V8_SSOT.md`) requires ROI to be evidence-based, source-aware, and governance-safe.
- As-is runtime already satisfies route/component/API baseline for ROI tracking in Results.
- Delta to close for target quality:
  - strengthen read-back and degraded variance assertions (`P1`);
  - deepen ownership and lineage codification for Results-Finance linkage (`P2`);
  - preserve explicit-write and no-hidden-write posture as non-negotiable (`P0` baseline kept).

## 13. Initiative List (C)

| Bucket | Initiative | Task ID | Outcome |
| --- | --- | --- | --- |
| Must-have | Lock contract boundary and evidence baseline for ROI tracking. | `RZ-ROI-P0-001` | immutable scope contract, evidence-complete docs gate |
| Client-grade | Harden read-back + degraded variance assertions in ROI tracking runtime. | `RZ-ROI-P1-001` | stronger trust in ROI updates and degraded-state operator handling |
| World-class | Deepen lineage + ownership proof between Results ROI truth and Finance interpretation. | `RZ-ROI-P2-001` | enterprise-grade reconciliation traceability and no-leak assurance |

## 14. Unified Plan (D)

### Phase order and dependencies

1. `RZ-ROI-P0-001` -> freeze docs contract, evidence map, and ownership rule.
2. `RZ-ROI-P1-001` -> implement/verify read-back + degraded variance tests (depends on P0).
3. `RZ-ROI-P2-001` -> expand lineage/ownership evidence and reconciliation matrix (depends on P0 + P1).

### Gate checkpoints

- `G0_SCOPE_LOCK`: one scope anchor only (`07_rezultaty/RZ_ROI_TRACKING`) and docs-only pass.
- `G1_EVIDENCE_BASELINE`: every critical claim keeps route + component + API + test evidence.
- `G2_RUNTIME_TRUST`: read-back and degraded variance assertions are explicitly covered (`P1`).
- `G3_OWNERSHIP_GUARD`: ownership-leak and lineage matrix evidence are explicit (`P2`).
- `G4_APPROVAL`: final decision posture (`APPROVED_FOR_DOCS` vs `PASS_WITH_P2`) documented with unblock conditions.

## 15. Approval / Unblock Proposal (E)

| Decision item | Current state | Unblock condition | Decision |
| --- | --- | --- | --- |
| Docs contract closure | Complete for this scope anchor | none | `APPROVED_FOR_DOCS` |
| Runtime trust hardening | Partial (read-back/degraded depth) | complete `RZ-ROI-P1-001` evidence | `WAITING_P1` |
| Ownership proof hardening | Partial (no dedicated automated no-leak guard) | complete `RZ-ROI-P2-001` matrix/assertion evidence | `WAITING_P2` |

## 16. Open Risks and Findings

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-ROI-P0-001` | `07_rezultaty/RZ_ROI_TRACKING` | `P0` | `READY` | `docs` | owner docs acceptance | route `/benefits`; component ROI tab/drawers; API V8 ROI contracts; tests routeMapping + ROI suites | `functions/RZ_ROI_TRACKING.md` |
| `RZ-ROI-P1-001` | `07_rezultaty/RZ_ROI_TRACKING` | `P1` | `WAITING_P0` | `test/docs` | `RZ-ROI-P0-001` | add degraded-state and read-back direct assertions for ROI tracking | `functions/RZ_ROI_TRACKING.md` |
| `RZ-ROI-P2-001` | `07_rezultaty/RZ_ROI_TRACKING` | `P2` | `WAITING_P0` | `docs` | `RZ-ROI-P0-001`,`RZ-ROI-P1-001` | deepen lineage evidence and finance handoff references | `functions/RZ_ROI_TRACKING.md` |

## 17. Gate Verdict
- Function docs closeout verdict: `APPROVED_FOR_DOCS`.
- Runtime hardening is tracked by `RZ-ROI-P1-001` and `RZ-ROI-P2-001`.
- Full-cycle mode decision (`gap->raw->initiatives->plan->approval`): `APPROVED_FOR_DOCS_WITH_P1_P2_FOLLOWUPS`.
