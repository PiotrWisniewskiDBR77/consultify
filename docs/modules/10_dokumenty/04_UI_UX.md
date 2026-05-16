---
module_id: MODULE_DOCUMENTS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Dokumenty (Document Studio)

## Purpose

UI/UX kontrakt dla Document Studio: intake panel, workspace preview, export, QA feedback, oraz spójny placement AI actions (Menu 3) w istniejących powierzchniach (chat-first + Outputs hub).

## Must

- MUST: UI rośnie w istniejących powierzchniach (Outputs hub + panel/workspace), bez osobnych toolbarów; AI actions po prawej w Menu 3.
- MUST: flow Mode 1 pokazuje: intake → outline proposal → accept → generating/QA → draft preview.
- MUST: “honest failure” (błędy, brak źródeł, invalid export) jest jawny i recovery-friendly.

## Must Not

- MUST NOT: ukrywać stanu QA lub udawać, że dokument jest “gotowy” bez źródeł (oznaczać `assumptions`).

## Should

- SHOULD: łączyć UI z Outputs Library (artefakt zawsze widoczny w bibliotece, z linkiem do workspace).

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`

