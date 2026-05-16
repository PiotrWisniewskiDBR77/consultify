---
module_id: MODULE_EXECUTION
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Realizacja (Execution)

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji dla 3 powierzchni (`Portfolio/Raporty/Manager`) i “honest degraded posture”.

## Must

- MUST: `Portfolio` działa w table+preview i nie crashuje na wejściu do `/execution`.
- MUST: `Raporty` jest katalogiem raportów (nie drugi portfolio list).
- MUST: `Manager` umożliwia interwencje bounded i po write jest read-back/verify.
- MUST: brak baseliny/estymaty jest jawny (no fake precision).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: testować przynajmniej 1 ścieżkę “exception → recommendation → bounded action → verify”.

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`

