---
module_id: MODULE_TABLES
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Tabele (Table Studio)

## Purpose

Kontrakt zachowania Table Studio: audyt, AI operator, QA i source pack, conversions, form intake, kill switches i “honest failure”.

## Must

- MUST: każda mutacja tabeli zapisuje audit ledger row (actor + timestamp + diff metadata).
- MUST: cross-tenant probes odmawiają (np. `TENANT_VIOLATION`) — deny-by-default.
- MUST: AI operator ma wielopoziomowe scope’y (cell/record/column/structure/view/relational/…); wyższe scope’y mogą być super-admin only.
- MUST: QA report pracuje na osi: completeness/freshness/source coverage/methodology/formula consistency i ma trwałe dismissals.
- MUST: konwersje zapisują audit rows (attempt history) i nie mają silent failures.
- MUST: public JWT intake wymusza allow-list pól + rate limits.

## Must Not

- MUST NOT: silent execution w konwersjach ani AI edycji (proposal/human-in-the-loop).
- MUST NOT: expose wrażliwych danych przez public intake poza allow-list.

## Should

- SHOULD: surface jest dark-by-default i flipnięty per workspace dopiero po residual follow-ups.

## Acceptance Criteria

- [ ] Każdy kluczowy flow (AI edit/QA/source pack/conversion/intake) ma jawne błędy (bez infinite spinner).

## Related Sources

- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`

