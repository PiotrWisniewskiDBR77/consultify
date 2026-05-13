---
module_id: MODULE_INITIATIVES
doc_kind: PURPOSE
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Purpose — Inicjatywy

## Purpose

System planowania i decyzji transformacyjnych: inicjatywa jest podstawowym obiektem konsultingowym łączącym źródła, zakres, decyzje, role, bramki i dalszą realizację.

Realizacja celu jest podzielona na funkcje: operacyjny portfolio hub, workspace analityczny oraz dedykowane powierzchnie tras `/roadmap`, `/portfolio` i `/roi`.

Contract 2.0 target: initiative work must be explainable end-to-end as source/evidence -> initiative readiness -> governed decision -> explicit handoff. The module is done only when its critical claims have route, component, API and test evidence.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.
- MUST expose the difference between initiative accountability and task execution responsibility.
- MUST keep AI advisory and source-backed; AI never approves gates or performs hidden writes.

## Must Not

- Execution task management as primary owner.
- Results/KPI ownership after realization tracking starts.
- Finance model ownership or silent ownership transfer of ROI assumptions.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.
- [ ] Critical purpose claims have route/component/API/test evidence in `07_ACCEPTANCE_AND_TESTS.md` and `SYSTEM_TRACEABILITY_MATRIX.md`.

## Related Sources

- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `DRD/consultify/docs/product/GATE_DEFINITION_OF_DONE.md`
- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
