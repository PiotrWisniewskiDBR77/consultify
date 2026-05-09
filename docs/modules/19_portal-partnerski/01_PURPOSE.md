---
module_id: MODULE_PARTNER_PORTAL
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Portal partnerski

## Purpose

Zdefiniować po co istnieje `Portal partnerski`: jako partner‑facing runtime programu partnerskiego, który prowadzi użytkownika przez lifecycle (**onboard → activate → earn → payout**) i daje operacyjne narzędzia (directory/resources/clients/earnings) bez rozjazdu z “operator truth”.

## Must

- **MUST**: Lifecycle partnera jest jawny i trwały; portal i operator widzą **tę samą prawdę** statusu (P29).
- **MUST**: Earnings/payouts opierają się na ledger semantics (append-only, derived balances; brak “magicznego salda” jako truth).
- **MUST**: Payout actions mają jasne gate’y (partner request vs operator approval/execute/reconcile).

## Must Not

- **MUST NOT**: Prowadzić do sprzecznych statusów partner vs operator.
- **MUST NOT**: Pozwalać na ukryte transitions i edycję historii ledger (korekty są nowymi wpisami).

## Should

- **SHOULD**: Dawać partnerowi jasne next steps w degraded states (missing payout settings, hold/review, provider failure).

## Acceptance Criteria

- [ ] Purpose jest spójny z P29: jedna maszyna stanów i jedna księga ledger, z jasnym podziałem partner vs operator.

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PARTNER_PROGRAM.md`

