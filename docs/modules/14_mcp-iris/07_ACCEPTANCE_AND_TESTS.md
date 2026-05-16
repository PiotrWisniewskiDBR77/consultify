---
module_id: MODULE_MCP_IRIS
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — MCP IRIS

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: provider health check jest jawny (healthy/degraded/down) i nie maskuje błędów.
- MUST: tool allowlist działa (brak wywołań narzędzi spoza listy).
- MUST: tenant/ACL deny-by-default (negatywne testy cross-tenant).
- MUST: audit log powstaje dla każdego tool call.

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: smoke test “test connection” bez side-effectów (dry run tool).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)

