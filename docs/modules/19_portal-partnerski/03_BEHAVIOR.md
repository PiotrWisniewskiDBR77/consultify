---
module_id: MODULE_PARTNER_PORTAL
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Portal partnerski

## Purpose

Opisać kontrakt zachowania portalu partnera: lifecycle transitions, earnings/payout UX, degraded/error posture, i współdzielona prawda z operatorem.

## Must

- **MUST**: Partner lifecycle jest jedną maszyną stanów: `onboard → activate → earn → payout` (UI copy może mieć sub-fazy, ale mapowanie jest stałe).
- **MUST**: Nie ma silent transitions; każdy transition ma aktora (partner/operator/system) i jest audytowalny.
- **MUST**: Payout flows:
  - partner może złożyć `payout.requested` (jeśli spełnione gate’y),
  - operator zatwierdza/wykonuje/reconciluje (poza portalem),
  - portal pokazuje status i historię bez ujawniania operator‑sensitive danych.
- **MUST**: Degraded posture (P29):
  - missing payout settings → jawny CTA + disabled request,
  - hold/review → jawny status + reason category + next step,
  - provider failure → jawny outcome + next step,
  - ledger outage → read-only degraded + writes fail closed.

## Must Not

- **MUST NOT**: Udawać wypłaty/zarobków (brak fake success).
- **MUST NOT**: Pozwalać na operator-only działania z portalu.

## Should

- **SHOULD**: Idempotency UX: powtórzone submit payout pokazuje istniejący request, bez duplikacji.

## Acceptance Criteria

- [ ] Zawiera jawne reguły `proposal -> approval -> execution -> audit` tam, gdzie czat inicjuje działania.
- [ ] Definiuje “uczciwe” stany błędów i degradacji (bez fake success / infinite spinner).

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`

