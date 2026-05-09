---
module_id: MODULE_TOOLS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Narzędzia / Tools

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST model each tool as inputs -> run/session -> output -> optional handoff.
- MUST persist ToolSession/source snapshots for audit.
- MUST explain gaps or degraded calculations.

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

- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`
- `DRD/consultify/docs/product/TOOLS_V8_SSOT.md`
- `DRD/consultify/docs/product/OPERATING_MODEL_V3.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/tools-library-detail-standard.md`
- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
