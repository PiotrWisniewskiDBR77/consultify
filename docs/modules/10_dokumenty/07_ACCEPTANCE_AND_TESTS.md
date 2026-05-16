---
module_id: MODULE_DOCUMENTS
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Dokumenty (Document Studio)

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: nie ma równoległego registry — trwały stan w v8.1 substrate.
- MUST: Mode 1 (MVP-1) end-to-end: intake → plan → generate → preview → export (DOCX/PDF).
- MUST: źródła i `is_assumption` są egzekwowane dla blocks bez źródeł.
- MUST: quality gates i “honest failure” (brak infinite spinner; jawne toasty/błędy).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: testy jednostkowe orchestratora (happy path + missing sources) zgodnie z planem MVP-1.

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)
- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`

