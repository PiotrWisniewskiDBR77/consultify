---
module_id: MODULE_OUTPUTS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Outputy (Outputs Library)

## Purpose

UI/UX kontrakt dla biblioteki artefaktów: hub z tabami, table+preview, stany loading/success/error/degraded oraz placement AI akcji w Menu 3.

## Must

- MUST: hub layout wg `module-hub-standard.md` (Menu 2 + Menu 3).
- MUST: listy artefaktów jako table+preview (All/Mine/Needs review/Documents/Presentations/Sheets/Templates).
- MUST: “Open in builder” i handoff muszą mieć jawny feedback (toast) przy failu.
- MUST: AI actions są po prawej w Menu 3 (bez duplikacji w canvase).

## Must Not

- MUST NOT: infinite spinner jako stan końcowy (np. “Postęp 0/8” bez error).
- MUST NOT: pokazywać artefaktów spoza scope widoczności usera.

## Should

- SHOULD: mieć szybkie filtry “recent / linked to initiative / needs review” spójne z My Work.

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`

