---
module_id: MODULE_PARTNER_PORTAL
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Portal partnerski

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- **MUST**:
  - lifecycle state machine jest jawna i spójna (onboard/activate/earn/payout),
  - portal i operator tower nie pokazują sprzecznych statusów,
  - payout request jest idempotent i audytowalny,
  - degraded states są uczciwe (hold/review, missing payout settings, provider failure, ledger outage).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- TBD

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md` (§2.3.7 acceptance checklist)

