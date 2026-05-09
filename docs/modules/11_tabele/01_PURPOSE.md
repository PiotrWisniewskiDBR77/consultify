---
module_id: MODULE_TABLES
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Tabele (Table Studio)

## Purpose

Zdefiniować po co istnieje Table Studio: szybkie “operational data work” na tabelach + szablonach, z audytem, proweniencją i AI operatorem/QA jako wsparciem (nie silent autopilotem).

## Must

- MUST: zapewnić template catalog (draft/approved/deprecated) + seeded base templates.
- MUST: każda mutacja danych ma audit ledger (provenance + actor + timestamp).
- MUST: AI operator działa w trybie proposal/human-in-the-loop; koszt kontrolowany (token budgets).
- MUST: konwersje table → document/presentation są audytowalne i deterministyczne w error handling.

## Must Not

- MUST NOT: pozwolić na cross-tenant leakage (TENANT_VIOLATION na probes).
- MUST NOT: wprowadzać “ukrytych AI mutacji” bez audytu i zatwierdzenia.

## Should

- TBD

## Acceptance Criteria

- [ ] Purpose jest spójny z `TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`.

## Related Sources

- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`

