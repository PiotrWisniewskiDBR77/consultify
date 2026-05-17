---
module_id: MODULE_RESULTS
doc_kind: INTEGRATION_REPORT
version: 2.0
owner: user
status: review
last_updated: 2026-05-11
scope_anchor: 07_rezultaty/MODULE_INTEGRATION
work_type: docs-only
mode: full integration
---

# Integration Report — 07_rezultaty

## 1. Integration Scope

Primary functions:
- `RZ_INITIATIVES_TRACKING`
- `RZ_KPI_WORKSPACE`
- `RZ_REPORTS_WORKSPACE`
- `RZ_ROI_TRACKING`
- `RZ_ROI_ANALYSIS`

Companion impact-only:
- `RZ_KPI_OKR_ROUTE`

## 2. Files Normalized In This Cycle

- `IMPLEMENTATION_TASK_BOARD.md`
- `RAW_TARGET_STATE_2_0_PACKET.md`
- `STATUS.md`
- `CHANGELOG.md`
- `functions/RZ_ROI_ANALYSIS.md`
- `function-cards/*_EXECUTION_CARD.md` (consistency validation)

## 3. Module Gap Matrix (P0/P1/P2)

| Function | P0 | P1 | P2 |
| --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | closed | indirect tab-assertion depth | premium lineage/degraded depth |
| `RZ_KPI_WORKSPACE` | closed | direct scorecards/lifecycle assertions | premium trust hardening |
| `RZ_REPORTS_WORKSPACE` | closed | approval/finalization guard proof | `MISSING_EVIDENCE` + R1-R4 lineage depth |
| `RZ_ROI_TRACKING` | closed | read-back/degraded variance depth | no-leak ownership proof |
| `RZ_ROI_ANALYSIS` | closed | explainability-quality gating | explicit approval/lock semantics |

Companion:
- `RZ_KPI_OKR_ROUTE`: parity strategy remains `P2` impact decision.

## 4. RAW-to-Target Synthesis

RAW and SoT converge on one target:

`initiative -> KPI -> execution -> deviation -> corrective action -> realized ROI -> reconciliation -> verified result -> report`

Applied integration interpretation:
- Results is governed evidence/intervention layer (not passive dashboard).
- Finance linkage is explicit and optional; truth ownership remains split.
- Reporting is template-first, source-evidence-aware, and approval-governed.
- High-impact claims require `route + component + API + test`.

## 5. Consolidated Initiatives (Canonical Set)

- `RZ-INI-P0/1/2-001`
- `RZ-KPI-P0/1/2-001`
- `RZ-REP-P0/1/2-001`
- `RZ-ROI-P0/1/2-001`
- `RZ-RAN-P0/1/2-001`

Cardinality and quality checks:
- no duplicate canonical IDs,
- one row per scope anchor,
- dependency chain `P0 -> P1 -> P2` preserved per function.

## 6. Unified Development Plan

### Wave 1 (P0): docs baseline lock
- close module docs coherence and evidence matrices,
- sync task board, function cards, packet and report,
- run docs gate.

### Wave 2 (P1): runtime evidence readiness
- direct assertions for previously indirect or inconclusive critical claims,
- explicit approval/finalization/no-hidden-write proof paths.

### Wave 3 (P2): premium governance hardening
- provenance/lineage depth and trust posture upgrades,
- ownership-leak negative evidence and parity decisions.

Gate policy:
- missing critical evidence row => `NOT_DONE`,
- unresolved P1 critical claim => `BLOCKED_P1`.

## 7. Evidence Baseline Table

| Type | Baseline |
| --- | --- |
| Route | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` |
| Component | `src/components/Results/ResultsHub.tsx`, `src/components/Results/*`, `src/views/KpiOkrView.tsx` |
| API | `src/services/api/v8/results.ts`, compatibility seam in `src/services/api.ts` |
| Test | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/*`, selected smoke suites |

## 8. Gate Result

Command: `npm run docs:contract:rerun-gate`

Output:
- Checked modules: `19`
- Checked function contracts: `77`
- Errors: `0`
- Warnings: `0`
- Report: `test-results/module-contract-gate/module-contract-gate.md`

## 9. Final Decision

- Docs decision: `APPROVED_FOR_DOCS`
- Runtime decision: `BLOCKED_P1`

Reason:
- docs integration is complete and internally consistent,
- runtime critical-evidence closures intentionally remain in P1 backlog.

## 10. Next Executable Step

1. Execute `RZ-REP-P1-001` (approval/finalization guard proof).
2. Execute `RZ-ROI-P1-001` and `RZ-RAN-P1-001` (ROI trust and explainability closures).
3. Re-run gate and update decision when P1 evidence exits `INCONCLUSIVE`.
