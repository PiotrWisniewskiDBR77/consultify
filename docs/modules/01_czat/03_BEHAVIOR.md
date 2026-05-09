---
module_id: MODULE_CHAT
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Czat

## Purpose

Opisać kontrakt zachowania czatu: odpowiedzi, tryby, działania, approvals, audyt, ciągłość sesji.

## Must

- TBD (migracja z `CHAT_V8_*` + `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`)

## Must Not

- TBD (szczególnie: silent execution, hidden learning, raw internals)

## Should

- TBD

## Acceptance Criteria

- [ ] Zawiera jawne reguły `proposal -> approval -> execution -> audit` tam, gdzie czat inicjuje działania.
- [ ] Definiuje “uczciwe” stany błędów i degradacji (bez fake success / infinite spinner).

## Related Sources

- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`

