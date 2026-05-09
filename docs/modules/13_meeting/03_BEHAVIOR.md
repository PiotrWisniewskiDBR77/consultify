---
module_id: MODULE_MEETING
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Meeting

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST connect meeting outputs to decisions/tasks/artifacts with explicit approval.
- MUST keep pre-read and outcomes traceable.

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

- `DRD/consultify/docs/product/MEETING_TOOL_V3.md`
- `DRD/consultify/docs/product/REQUIREMENTS_V3_SSOT.md`
- `DRD/consultify/docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `DRD/consultify/docs/product/V3_MODULE_VERIFICATION_MATRIX.md`
