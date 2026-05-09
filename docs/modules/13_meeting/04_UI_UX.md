---
module_id: MODULE_MEETING
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Meeting

## Purpose

UI/UX kontrakt Meeting: proste capture + strukturyzacja + linkowanie, z globalnymi invariantami i placement AI actions w Menu 3.

## Must

- MUST: uczciwe stany empty/error/degraded (np. brak integracji calendar).
- MUST: AI actions tylko w Menu 3 / command row (bez osobnego paska w canvase).
- MUST: “propose → accept” dla AI zmian (np. ekstrakcja action items).

## Must Not

- MUST NOT: infinite spinner / fake success.

## Should

- SHOULD: table+preview dla listy meetingów/notatek, jeśli moduł dostanie hub.

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`

