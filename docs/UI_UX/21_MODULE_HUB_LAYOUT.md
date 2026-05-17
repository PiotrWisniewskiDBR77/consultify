---
uiux_doc_id: UIUX_MODULE_HUB_LAYOUT
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Module hub layout (hub/list screens)

## Purpose

Zamknąć standard layoutu ekranów modułowych typu hub/list: Menu 2/3, tabela/karty, filtry, preview, row actions — bez lokalnych wariantów.

## Applies To

My Work, Tools, Interview, Initiatives, Execution, Results, Finance, Outputs i inne moduły kolekcyjne.

## Must

- **MUST**: Układ jest zgodny ze standardem “Module Hub” (Menu 2 + jeden Menu 3 + content).
- **MUST**: View modes są spójne (segmented icons, stała kolejność).
- **MUST**: Dla list rekordów operacyjnych kanoniczny jest `App Table Standard` (table-fixed / resizable columns / header filters / kebab actions).
- **MUST**: Brak duplikowania toolbarów między topbarem a tabelą.

## Should

- **SHOULD**: Preview pane (Outlook style) jest używany tam, gdzie selection→preview daje wartość (szczególnie tabele).

## Acceptance Criteria

- [ ] Ekran przechodzi checklistę z `module-hub-standard.md` (Menu 2/3 + App Table).

## Related Sources

- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/app-table-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/view-modes-standard.md`
- `DRD/consultify/docs/ui-standards/03-modules/table-preview-pane-standard.md`

