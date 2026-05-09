---
module_id: MODULE_PARTNER_PORTAL
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Portal partnerski

## Purpose

Opisać: dane programu partnerskiego widoczne w portalu (lifecycle status, earnings ledger summary, payout requests/history, directory profile) oraz ich pochodzenie i integracje (billing/subscriptions jako źródła accrual).

## Must

- **MUST**: Earnings/payout “truth” opiera się na ledger modelu (append-only entries) i derived balances.
- **MUST**: Idempotency i correlation_id dla zdarzeń finansowych (payout request, adjustments) zapobiega duplikatom.

## Must Not

- **MUST NOT**: Pozwalać na edycję historycznych wpisów ledger; korekty to nowe wpisy.

## Should

- **SHOULD**: W portalu pokazać partnerowi “source_ref” w formie bezpiecznej (np. odwołanie do klienta/kampanii) tam gdzie to wspiera zaufanie.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md` (§2.3.2 ledger semantics)

