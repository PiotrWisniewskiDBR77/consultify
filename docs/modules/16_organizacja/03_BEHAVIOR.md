---
module_id: MODULE_ORGANIZATION
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Organizacja / Organization Context

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST use permission-filtered chunks only.
- MUST show partial/blocked/degraded states for context availability.
- MUST preserve lineage from raw material to cited answer.

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

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_30_ORGANIZATION_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ORGANIZATION.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`
- `DRD/consultify/docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_ANALYSIS.md`
- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
