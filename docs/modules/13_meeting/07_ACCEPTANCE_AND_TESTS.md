---
module_id: MODULE_MEETING
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Meeting

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: brak silent AI writes; każda AI strukturyzacja jest proposal-first.
- MUST: jawne stany degraded gdy brak integracji (np. calendar).
- MUST: tenant/ACL deny-by-default.

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: smoke test: notatka → action items → link do Initiative (jeśli moduł dostanie runtime).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)

