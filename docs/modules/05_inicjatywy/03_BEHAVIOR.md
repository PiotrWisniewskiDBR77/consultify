---
module_id: MODULE_INITIATIVES
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Inicjatywy

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST enforce source traceability before promotion.
- MUST use gate DoD and status-role CTA matrix for transitions.
- MUST represent decisions explicitly, not as hidden comments.
- MUST resolve roles/capabilities server-side; UI must not infer permissions.

## Must Not

- MUST NOT silently mutate high-impact objects.
- MUST NOT show fake success, hide blocking errors or leave users in infinite loading states.
- MUST NOT bypass source, role, approval or tenant constraints for convenience.

## Should

- SHOULD expose recovery paths for failed or degraded states.
- SHOULD make AI-generated proposals reviewable before they become durable state.

## Acceptance Criteria

- [ ] Main happy path can be executed end-to-end with visible state transitions.
- [ ] Error/degraded/empty states are explicit and recoverable.
- [ ] Any AI or automation action is auditable and approval-aware.

## Related Sources

- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `DRD/consultify/docs/product/GATE_DEFINITION_OF_DONE.md`
- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
