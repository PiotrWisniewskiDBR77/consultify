---
module_id: MODULE_TABLES
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Tabele (Table Studio)

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: unit test coverage na core services (AI editor/QA/source pack/conversions/intake) jest utrzymana (program closeout wskazuje PASS 146/146).
- MUST: cross-tenant probes refuse (`TENANT_VIOLATION`) — testowane.
- MUST: public JWT intake egzekwuje allow-list i rate limits — testowane.
- MUST: UI ma jawne błędy (bez infinite spinner) w AI/QA/conversions.

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: utrzymać smoke test Anygravity trial (manual) jako gate flipnięcia kill switchy.

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)
- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`

