---
module_id: MODULE_MCP_IRIS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — MCP IRIS

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST enforce allowlist and provider health checks.
- MUST map errors/conflicts explicitly and preserve idempotency for outbound actions.

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

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `DRD/consultify/docs/product/INTEGRATIONS_CONNECTOR_RUNBOOKS_ENTERPRISE_V3.md`
