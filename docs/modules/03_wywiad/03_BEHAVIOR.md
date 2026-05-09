---
module_id: MODULE_INTERVIEW
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Wywiad / Interview

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST separate template lifecycle from respondent submission lifecycle.
- MUST preserve raw response evidence and derived insight lineage.
- MUST support upload/storage as real evidence, not only UI decoration.

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

- `DRD/consultify/docs/modules/DISCOVERY_CONSULTANT_MODULE.md`
- `DRD/consultify/docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `DRD/consultify/docs/product/INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
