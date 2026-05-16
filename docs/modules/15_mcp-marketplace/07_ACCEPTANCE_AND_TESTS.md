---
module_id: MODULE_MCP_MARKETPLACE
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — MCP Marketplace (DBR77)

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: co najmniej 3 narzędzia READ działają end-to-end (search/get/recommendations).
- MUST: import do Tools/Presentations jest jawny i ma traceability do assetu.
- MUST: audit log powstaje dla tool calls.
- MUST: deny-by-default dla narzędzi spoza allowlist oraz dla nieuprawnionych ról.

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: smoke test “provider degraded/down” pokazuje jawny stan i nie blokuje całej aplikacji.

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)

