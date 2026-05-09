---
module_id: MODULE_FINANCE
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Finanse

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: AI nie generuje liczb bez anchora (manual test).
- MUST: invalid model jest jawny i blokuje eksport/approval.
- MUST: Economics flow: create/update financials → scenarios → activate scenario → approve.
- MUST: deny-by-default przy braku uprawnień (brak danych zamiast “partial leak”).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: integration test coverage istnieje (as-is): `tests/integration/routes/economicsFlow.test.js` oraz `tests/backend/services/economicsFinancials.test.ts` (zgodnie z `ECONOMICS_MODULE.md`).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/FINANCIAL_ANALYSIS_V3.md`
- `DRD/consultify/docs/modules/ECONOMICS_MODULE.md`

