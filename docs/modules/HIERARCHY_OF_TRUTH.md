---
doc_id: HIERARCHY_OF_TRUTH
doc_kind: GOVERNANCE_STANDARD
owner: user
status: canonical
last_updated: 2026-05-10
---

# Consultify Hierarchy of Truth (Frozen)

## Purpose

Define one unambiguous conflict-resolution order for documentation and runtime truth in Consultify.

This document is binding for:

- product documentation changes,
- module contract changes,
- PR review and merge gates,
- quality gate reruns.

## Global Conflict Resolution Order (L0-L7)

When two sources conflict, apply this order from highest priority to lowest.

1. **L0 - Runtime security and tenancy invariants**
   - `.cursor/rules/40-security-tenancy.mdc`
   - deny-by-default behavior in runtime code (`server/src/**`, `src/**`)
2. **L1 - Global repository governance**
   - `README.md`
   - `.cursor/SOURCE_OF_TRUTH_INDEX.md`
   - `.cursor/rules/00-core-execution.mdc`
   - `.cursor/rules/10-context-loading.mdc`
3. **L2 - Domain SSOT**
   - `DRD/UI_UX_SOURCE_OF_TRUTH.md`
   - `DRD/consultify/docs/product/DOCUMENTATION_REGISTRY.md`
   - `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
4. **L3 - Module governance standards**
   - `docs/modules/README.md`
   - `docs/modules/UI_UX_CONTRACT_INDEX.md`
   - `docs/modules/FUNCTION_CONTRACT_STANDARD.md`
   - `docs/modules/FUNCTION_CONTRACT_TEMPLATE.md`
   - `docs/modules/MODULE_INTERACTION_GRAPH.md`
   - `docs/modules/CONTROL_PLANE_CONTRACT.md`
   - `docs/modules/END_TO_END_WORKFLOWS.md`
   - `docs/modules/CROSS_MODULE_PERMISSION_MATRIX.md`
   - `docs/modules/APPROVED_COMPONENT_COMPOSITION.md`
   - `docs/modules/ARTIFACT_LINEAGE_MATRIX.md`
   - `docs/modules/UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`
   - `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md`
   - `docs/modules/EVIDENCE_REGISTRY.md`
   - `docs/modules/DECISION_LOG.md`
   - `docs/modules/CHANGE_TYPE_DOR_DOD.md`
   - `docs/modules/RELEASE_READINESS_CONTRACT.md`
5. **L4 - Module contract layer (canonical per module)**
   - `docs/modules/<NN_slug>/00_META.md`
   - `docs/modules/<NN_slug>/01_PURPOSE.md`
   - `docs/modules/<NN_slug>/02_SCOPE.md`
   - `docs/modules/<NN_slug>/03_BEHAVIOR.md`
   - `docs/modules/<NN_slug>/04_UI_UX.md`
   - `docs/modules/<NN_slug>/05_DATA_AND_INTEGRATIONS.md`
   - `docs/modules/<NN_slug>/06_PERMISSIONS_AND_SECURITY.md`
   - `docs/modules/<NN_slug>/07_ACCEPTANCE_AND_TESTS.md`
6. **L5 - Function contract layer (canonical per function)**
   - `docs/modules/<NN_slug>/functions/*.md`
7. **L6 - Navigational and operational context**
   - `docs/modules/<NN_slug>/README.md`
   - `docs/modules/<NN_slug>/SSOT.md`
   - `docs/modules/<NN_slug>/CODEMAP.md`
   - `docs/modules/<NN_slug>/STATUS.md`
8. **L7 - Raw and historical references (non-canonical)**
   - `docs/modules/<NN_slug>/RAW_INPUT.md`
   - `DRD/consultify/docs/UI_UX/*.md`
   - historical reports and legacy notes

If a lower layer conflicts with a higher one, the higher layer wins and the lower layer must be updated in the same PR.

## Per-Module Conflict Rule (Frozen)

Every module (`01_czat` to `19_portal-partnerski`) MUST resolve conflicts in this exact order:

1. Module contract layer (`00`-`07`).
2. Function contracts (`functions/*.md`).
3. Module support docs (`CODEMAP.md`, `STATUS.md`, `SSOT.md`, `README.md`).
4. Raw author input (`RAW_INPUT.md`) and external raw packs.

Additional module rule:

- If `04_UI_UX.md` and any `functions/*.md` conflict on function behavior, `functions/*.md` wins for function details, and `04_UI_UX.md` must be synchronized before merge.

## Runtime vs Documentation

When runtime and docs conflict:

1. Treat runtime as current behavior truth.
2. Open `code_gap` in impacted module contracts.
3. Update contracts in the same PR if change is intentional.
4. Block merge if runtime changed but required contracts were not updated (CI gate).

## Mandatory Update Set For Runtime PRs

When runtime behavior changes for a module, PR MUST update all applicable artifacts:

- `CODEMAP.md`
- `03_BEHAVIOR.md`
- `04_UI_UX.md`
- `07_ACCEPTANCE_AND_TESTS.md`
- `STATUS.md`
- `functions/*.md` for impacted function(s)

The CI gate enforces this as a hard merge condition.

## Evidence Binding Rule

Every critical contract claim MUST point to runtime evidence:

- route evidence (`routeConfig.ts`, `AppRoutes.tsx`, route screen path),
- component evidence (`src/components/**`, `src/views/**`),
- API evidence (`server/src/routes/**`, service or controller),
- test evidence (`tests/**`, `e2e/**`).

Claims without evidence links are non-compliant and fail contract gate checks for changed docs.

## Ownership Binding Rule

- Every module has two owners: `business_owner` and `tech_owner`.
- Every function has resolved ownership (explicit or inherited from module owner registry).
- Contract changes require owner acceptance as defined in `docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md`.

## Governance Enforcement

This hierarchy is enforced by:

- `scripts/testing/module-contract-pr-gate.ts` (PR blocking),
- `scripts/testing/module-contract-rerun-gate.ts` (cyclical rerun),
- `.github/workflows/test-suite.yml`,
- `.github/workflows/module-contract-rerun.yml`.
