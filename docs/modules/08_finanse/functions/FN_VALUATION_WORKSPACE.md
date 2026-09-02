---
module_id: MODULE_FINANCE
function_id: FN_VALUATION_WORKSPACE
function_name: Finance — Valuation Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Valuation Workspace

## 1. Function Identity
- Function ID: `FN_VALUATION_WORKSPACE`
- Runtime anchor: `FinanceHub` tab `valuation`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: evaluate enterprise valuation cases with auditable assumptions, source-proven model inputs, and explicit approval before final claim or export.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI: valuation tab in `FinanceHub`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: valuation sources (model/analysis/budget/manual), valuation methods, assumption sets, market parameters, and evidence lineage metadata.

## 6. Outputs and Side Effects
- Outputs: explicit valuation actions, valuation ranges/memos, approval-ready claim packages, and downstream decision support.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.
- Degraded mode must explicitly mark when valuation outputs are low-confidence, partially sourced, or blocked from final-claim/export usage.

## 9. AI, Source, Evidence, Approval
- Security/provenance: valuation source and method transparency required.
- Assumptions posture: valuation assumptions must remain explicit (`owner`, `source`, `confidence`, `status`) before trust is elevated.
- Approval boundary: high-impact valuation claims/exports require explicit human review and approval prior to final business truth usage.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `08_finanse` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `08_finanse` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `08_finanse` user flows.

## 12. Phase 2 RAW Synthesis (must/should/out)

| Class | Requirement | Scope note | RAW source reference |
| --- | --- | --- | --- |
| `MUST` | valuation assumptions remain explicit (`owner/source/confidence/status`) | hard gate for trust elevation | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12, Workflow 19, reqs: Model assumptions/Assumption source/Assumption confidence/Assumption owner) |
| `MUST` | valuation view shows source-backed outputs with lineage and confidence | applies to valuation claims and memo narratives | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine: "Musi pokazywać ... source confidence"; reqs: Source traceability, Data lineage) |
| `MUST` | explicit review/approval before final claim/export | final claim/export cannot bypass human gate | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, reqs: Valuation approval, Approval history) |
| `SHOULD` | valuation-specific evidence matrix route/component/API/test | docs-level evidence normalization for valuation lane | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (valuation addendum + known code gap) |
| `OUT` | runtime implementation of valuation UI controls/API behavior/tests | this pass is docs-only | `docs/modules/08_finanse/RAW_INPUT.md` (canonical baseline already migrated to contracts) |

## 13. As-Is Gap Ledger (Step 1)

| Gap area | As-is posture | Task linkage | Gate posture |
| --- | --- | --- | --- |
| valuation assumptions envelope | assumptions are referenced in doctrine, but valuation contract lacked one normalized envelope per claim | `FN-VLU-P0-001` | `PASS_WITH_P1` |
| model/source provenance and lineage | source-traceability doctrine exists globally, but valuation-specific claim lineage matrix remains partial | `FN-VLU-P1-001` | `PASS_WITH_P1` |
| approval before final claim/export | review doctrine exists globally; valuation-specific finalization/export gate wording is still partially distributed | `FN-VLU-P1-001` | `PASS_WITH_P1` |
| dedicated valuation evidence matrix | no valuation-only route/component/API/test matrix linked as dedicated regression proof | `FN-VLU-P2-001` | `NOT_DONE` |

## 14. As-Is vs Target vs Delta + Decision Table (Step 2)

| Topic | As-Is | RAW target | Delta | Decision | Rationale | RAW source reference |
| --- | --- | --- | --- | --- | --- |
| valuation assumptions visibility | assumptions exist but are not consistently normalized per valuation claim | assumptions carry `owner/source/confidence/status` and must stay visible | incomplete normalization envelope | `ENHANCE` | reduce trust ambiguity before valuation consumption | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12; reqs 966-971), `docs/product/FINANCIAL_ANALYSIS_V3.md` (2.5 Market Assumptions + Valuation artifact) |
| model/source provenance traceability | provenance doctrine exists at module level | each valuation claim references model snapshot and source lineage | valuation-level mapping fragmented | `NEW` | enforce auditable claim lineage for CFO-grade decisions | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine + Source traceability/Data lineage), `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (same canonical RAW packet) |
| approval before final claim/export | explicit actions exist but valuation final gate is not fully centralized | final valuation claim/export requires explicit human review/approval | checkpoint wording dispersed | `ENHANCE` | prevent premature externalization of unapproved valuation | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, req 1024), `docs/product/FINANCIAL_ANALYSIS_V3.md` (Valuation status `DRAFT -> REVIEW -> APPROVED`) |
| Menu 3 AI placement | module-level Menu 3 doctrine is already enforced | right-side command-row usage, no duplicate AI toolbar in canvas | no valuation-specific contradiction found | `KEEP` | canonical placement is already aligned | `docs/modules/08_finanse/04_UI_UX.md` (Menu 3 / AI placement contract), `.cursor/rules/ai-actions-menu3.mdc` |
| dedicated valuation regression evidence | finance tests are partial and valuation probes are not function-specific | valuation-specific route/component/API/test matrix with hard links | dedicated matrix missing | `DEFER` | keep explicit `NOT_DONE` until evidence is produced | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (known code gap + valuation addendum) |

## 15. Evidence Mapping (assumptions, source backing, explicit review gate)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status | RAW source reference |
| --- | --- | --- | --- | --- | --- | --- |
| valuation assumptions are explicit before trust | valuation tab route anchor in finance runtime | valuation UX requires assumptions envelope visibility | valuation payload includes assumptions list/metadata | function-specific valuation assumption probe missing | `PASS_WITH_P1` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12, req 966-971) |
| valuation claims are source-backed | valuation lane is mounted in finance flow | valuation summary/memo requires source confidence + provenance | valuation path preserves lineage markers | dedicated provenance probe missing | `PASS_WITH_P1` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine + req 1048-1049) |
| review gate exists before final claim/export | valuation output/export actions are explicit runtime actions | valuation review controls expected before final claim/export | approval status boundary expected in valuation payload | dedicated export-gate probe missing | `PASS_WITH_P1` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, req 1024) |
| dedicated valuation evidence matrix is complete | n/a | n/a | n/a | valuation-only suite missing | `NOT_DONE` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (valuation addendum) |

## 12. Open Risks and Change Log
- Risk: valuation outputs can still be over-trusted if dedicated valuation regression evidence remains unresolved (`FN-VLU-P2-001`).

### Runtime measurement — 2026-09-01

Full evidence and citations: `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`
(section 1); source: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY233_FINANSE_REPORT.md`.

- `18/21` valuation panels call a real backend endpoint (full `ApiGateway` +
  signed JWT + real Postgres, `2xx` with non-empty `body.data`). Three panels
  are intentionally client-side/prop-driven, not a gap: `DriverPlannerPanel`
  (local computation), `EvBasketFootballField` (renders from props),
  `ValuationVisualsPanel` (renders from props).
- Earlier claim of `5/21` is **refuted 2026-09-01** — it referenced a file
  that does not exist in the repository.
- `25/26` finance module screens are closed behind feature flags by default —
  this is the intended controlled visual rollout, not a defect.
- A "management report" export for valuation does not exist in code today;
  `ExportStep.tsx` is an honest placeholder. Whether this ships inside or
  outside MVP is an open owner decision.
