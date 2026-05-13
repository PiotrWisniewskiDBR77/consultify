---
module_id: MODULE_RESULTS
function_id: RZ_REPORTS_WORKSPACE
function_name: Results — Reports Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Reports Workspace

## 1. Function Identity
- Function ID: `RZ_REPORTS_WORKSPACE`
- Runtime anchor: `ResultsHub` tab `results_reports`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_REPORTS_WORKSPACE`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/07_rezultaty/03_BEHAVIOR.md`
  - `docs/modules/07_rezultaty/04_UI_UX.md`
  - `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/REPORTING_CANONICAL_TEMPLATES.md`

## 2. User Job and Business Outcome
- Purpose: prepare, review and refresh governed results reports with explicit scope, source and evidence posture.
- Primary user question: "Czy ten raport ma kompletne zrodla i czy moze byc pokazany jako approved?"
- Business outcome: reporting workspace that keeps one governed truth (no second KPI/ROI truth) and explicit approval boundaries.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=results_reports` is a valid runtime branch and can be entered from tracked KPI context.

## 4. UI Component Footprint
- `ResultsHub` keeps `results_reports` in runtime tab map and switches report workspace modes (`tracked`, `schedules`, enterprise views).
- `ResultsKpiReportsView` is the report list + preview + actions surface.
- Report interactions remain in module runtime and do not require route change outside `/benefits`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: KPI and initiative scope selections, queue context (`requiresReview`, `discrepancy`, `needsEntry`), report snapshot metadata.
- Canonical dependencies:
  - `src/services/api/v8/results.ts` (`createKpiReport`, `refreshKpiReport`) for governed report endpoints,
  - legacy fallback usage in `ResultsKpiReportsView` (`Api.get/post` for reports) only as compatibility path,
  - canonical report families and template doctrine in `docs/product/REPORTING_CANONICAL_TEMPLATES.md` (R1-R4 guardrails).

## 6. Outputs and Side Effects
- Output artifacts: report rows, preview relations, AI narrative hint, refresh feedback, action-draft handoff.
- Allowed side effects:
  - explicit report create from user action,
  - explicit report refresh from user action,
  - explicit navigation to follow-up contexts.
- Forbidden side effects:
  - hidden report finalization,
  - hidden approval state change,
  - silent write-back mutating KPI/ROI canonical truth through report rendering.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns report workspace interaction and report snapshot governance in Results runtime.
- Canonical object ownership remains with source modules/contracts (`KPI`, `BenefitsRecord`, ROI/economic inputs); reporting materializes review artifacts, not new truth.
- Handoff to execution/task systems may produce action drafts, but action creation remains human-confirmed.

## 8. Runtime States and UX Behavior
- Loading: report list/workspace loading must stay explicit.
- Empty: empty report list must remain explicit (no hidden "success" posture).
- Error: fetch/create/refresh failures must remain visible and actionable.
- Degraded: compatibility fallback/report gaps must be visibly degraded and not treated as approved truth.
- Success: report create/refresh feedback must confirm what changed and what remains to review.

## 9. AI, Source, Evidence, Approval
- AI actions for reports remain in Menu 3/right command placement; no duplicated canvas controls.
- Every report snapshot must expose:
  - source scope (initiative/KPI set),
  - provenance posture (snapshot vs refreshed),
  - evidence posture (`complete`, `partial`, or `missing`).
- Approval is explicit-only:
  - no hidden finalization branch is allowed,
  - no implicit "approved" status from AI narration or refresh completion.
- If evidence is incomplete, state must be explicit as `MISSING_EVIDENCE` (never silent).

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- Reporting output must not expose raw sensitive payloads when governed summary/source references are sufficient.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_REPORTS_WORKSPACE` is anchored in `/benefits` tab `results_reports`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}` -> `ResultsHub`) | `src/components/Results/ResultsHub.tsx` (`VALID_TABS`, `results_reports` branch) | `src/services/api/v8/results.ts` (`getDashboard` context load for Results runtime) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Reports workspace switches tracked/schedules views without route split. | `/benefits` route shell | `ResultsHub.tsx` (`reportWorkspaceMode`, `ResultsKpiReportsView`, enterprise report views) | runtime depends on report API responses | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (reports workspace surface switching) | `PASS` |
| Report creation/refresh is explicit user action and snapshot-based. | user action flow inside `/benefits?tab=results_reports` | `src/components/Results/ResultsKpiReportsView.tsx` (explicit create + refresh actions, snapshot hint) | `src/services/api/v8/results.ts` (`createKpiReport`, `refreshKpiReport`) with compatibility fallback `Api.post('/results/kpi-reports/:snapshotId/refresh')` | no dedicated unit/e2e assertion for approval/finalization transition | `PASS_WITH_P2` |
| Source/provenance/evidence completeness is explicit before report approval state. | `/benefits` reporting lane | `ResultsKpiReportsView.tsx` shows snapshot and review counters, but no explicit evidence-state badge contract found | `docs/product/REPORTING_CANONICAL_TEMPLATES.md` defines canonical source logic; endpoint-level evidence completeness flag not documented here | dedicated automated assertion for `MISSING_EVIDENCE` posture not found | `INCONCLUSIVE` |

## 12. As-Is -> Delta

### As-Is
- Reports tab and workspace mode switching are already active in `ResultsHub`.
- Report create/refresh flows exist and are explicit user actions.
- Canonical reporting families and source doctrine are defined in `REPORTING_CANONICAL_TEMPLATES`.

### Delta Closed In This Pass
- Locked function contract to immutable scope anchor `07_rezultaty/RZ_REPORTS_WORKSPACE`.
- Added hardened source/provenance/approval rules, including explicit `MISSING_EVIDENCE` posture.
- Added mandatory `route + component + API + test` evidence matrix with explicit uncertainty marking (`INCONCLUSIVE`) where evidence is missing.

## 13. Gap Analysis (A)

### A1. Source / Provenance gap
- As-Is evidence confirms source doctrine at module level, but report snapshot contract does not yet guarantee a visible, structured provenance set (`source_type`, `source_reference`, `source_confidence`, `evidence_refs`) at every review step.
- Consequence: report can look "ready" while provenance completeness is implicit.

### A2. Missing-evidence behavior gap
- As-Is docs define `MISSING_EVIDENCE`, but dedicated runtime/test evidence for this state is not locked.
- Consequence: risk of silent trust inflation (users interpret draft as approved-ready).

### A3. Approval / Finalization gap
- As-Is flow is explicit for create/refresh, but approval/finalization guard is not asserted end-to-end in tests.
- Consequence: inability to prove "no hidden finalization" under regression pressure.

## 14. RAW Premium Standard (B)

Derived from:
- `docs/product/REPORTING_CANONICAL_TEMPLATES.md` (R1-R4 mandatory families),
- `docs/product/RESULTS_V8_SSOT.md` (source/freshness, ROI evidence, review/lock doctrines),
- `docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` (source traceability + approval queue + evidence required posture).

Premium reporting standard for `RZ_REPORTS_WORKSPACE`:
1. Every report remains template-first and maps to canonical family (`R1`/`R2`/`R3`/`R4`).
2. Snapshot must carry explicit source/provenance posture, not narrative-only confidence.
3. `MISSING_EVIDENCE` blocks approved posture and remains visible until resolved.
4. Approval is explicit and role-scoped; refresh does not imply finalization.
5. Finalization is auditable and human-triggered; no hidden branch.

## 15. Development Initiatives List (C)

| Task ID | Priority | Initiative goal | Evidence target (`route + component + API + test`) |
| --- | --- | --- | --- |
| `RZ-REP-P0-001` | `P0` | Lock docs contract and RAW-to-contract alignment for source/provenance/approval behavior. | Route `/benefits`; components `ResultsHub` + `ResultsKpiReportsView`; API `createKpiReport`/`refreshKpiReport`; test references for route + reports lane switch. |
| `RZ-REP-P1-001` | `P1` | Add runtime-proofed approval/finalization guard (`no hidden finalization`). | Route reporting flow; component approval gate controls; API explicit approval/finalize endpoints or explicit non-existence contract; dedicated regression. |
| `RZ-REP-P2-001` | `P2` | Enrich provenance lineage and `MISSING_EVIDENCE` trust UX across R1-R4 templates. | Route/component evidence-state matrix; API lineage payload references; tests for missing-evidence visual state and trust downgrade. |

## 16. Unified Roadmap (D)

### Epic 1 — Contract Hardening (`P0`)
- Milestone M1: close gaps A1-A3 at docs level and map to one canonical behavior model.
- Milestone M2: sync task board + acceptance matrix with exact `RZ-REP-*` rows.
- Acceptance: docs gate can prove explicit source/provenance/approval posture with no runtime edits.

### Epic 2 — Runtime Guard Proof (`P1`)
- Milestone M3: implement and test explicit approval/finalization guard path for reports.
- Milestone M4: prove hidden-finalization prevention under regression.
- Acceptance: dedicated tests fail if report can reach final/approved posture without explicit action.

### Epic 3 — Trust and Lineage Enrichment (`P2`)
- Milestone M5: introduce report-level evidence-state model (`complete`/`partial`/`MISSING_EVIDENCE`) consistently in UI/docs/tests.
- Milestone M6: map R1-R4 template lineage expectations to report runtime evidence and review checklist.
- Acceptance: report trust posture is deterministic and auditable per template family.

## 17. Approval and Unblock Decision (E)

### Decision
- Docs closeout approval: `APPROVED_FOR_DOCS`.
- Runtime unblock decision: `UNBLOCK_P1_PREP_ONLY`.

### Meaning
- `RZ-REP-P0-001`: unblocked and ready now (docs complete).
- `RZ-REP-P1-001`: unblocked for implementation planning/execution next, but not completed in this pass.
- `RZ-REP-P2-001`: remains queued behind `P1` closure (`WAITING_P0` in board dependency terms).

### Hard guardrails
- No hidden finalization accepted at any stage.
- Missing evidence must remain explicit and non-approvable until resolved.
- Source/provenance posture is mandatory for any report presented as approved truth.

## 12. Open Risks and Change Log
- `P0`: none in docs closeout.
- `P1`: approval/finalization evidence path is not yet directly asserted in automated tests.
- `P2`: explicit UI signal for missing evidence/provenance completeness is not yet locked as runtime assertion evidence.
