---
module_id: MODULE_PARTNER_PORTAL
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Portal Partnerski

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST use single lifecycle: onboard -> activate -> earn -> payout.
- MUST keep ledger append-only and balances derived.
- MUST require operator gates for payout.

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

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PARTNER_PROGRAM.md`
- `DRD/consultify/docs/product/PARTNER_PROGRAM_V8_MASTER_SUMMARY.md`
- `DRD/consultify/docs/product/modules/partner/PARTNER_PORTAL_MODULE.md`
