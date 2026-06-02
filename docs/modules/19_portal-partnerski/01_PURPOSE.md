---
module_id: MODULE_PARTNER_PORTAL
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Portal Partnerski

## Purpose

Portal i program partnerski: lifecycle onboard -> activate -> earn -> payout, partner/operator roles, ledger and payout governance.

Cel jest realizowany przez funkcję chronionego workspace partnera i osobną funkcję granicy dla publicznej ścieżki akwizycyjnej.

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- General CRM or admin replacement.
- Mutable financial ledger without append-only audit.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PARTNER_PROGRAM.md`
- `DRD/consultify/docs/product/PARTNER_PROGRAM_V8_MASTER_SUMMARY.md`
- `DRD/consultify/docs/product/modules/partner/PARTNER_PORTAL_MODULE.md`
