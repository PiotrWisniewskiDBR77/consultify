---
module_id: MODULE_TOOLS
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Narzędzia

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów dla Tools (biblioteka + sesje + handoff).

## Must

- MUST: wejście do `/discovery-tools` działa i renderuje 4 kategorie.
- MUST: uruchomienie narzędzia tworzy sesję i pokazuje wynik (bez crash).
- MUST: “Generate initiative” prowadzi do flow inicjatyw (wizard) z zachowaniem treści/rationale.

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: szybkie testy ścieżek kategorii (strategic/operational/digital/process-automation).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty + refresh resistance (sesje).

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`

