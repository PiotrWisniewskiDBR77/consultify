---
module_id: MODULE_CHAT
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Czat / Teresa Chat Engine

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST expose selected context, sources and model/tool scope before high-impact work.
- MUST distinguish answer, proposal, draft artifact, decision and executable action.
- MUST require explicit approval before mutations, sends, publishes or governance transitions.
- MUST preserve conversation lineage for artifacts and decisions created from chat.
- MUST fail honestly with recoverable errors when tools, context or permissions are unavailable.

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

- `DRD/consultify/docs/product/CHAT_V8_SSOT.md`
- `DRD/consultify/docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- `DRD/consultify/docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
- `DRD/consultify/docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
