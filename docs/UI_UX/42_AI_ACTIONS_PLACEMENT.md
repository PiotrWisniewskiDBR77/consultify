---
uiux_doc_id: UIUX_AI_ACTIONS_PLACEMENT
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# AI actions placement — Menu 3 (command row)

## Purpose

Zamknąć regułę umieszczania kontekstowych akcji AI tak, by UI nie produkowało duplikatów toolbarów i zachowało przewidywalność.

## Applies To

Wszystkie moduły, dokumenty/artefakty, narzędzia, sekcje i canvas, które mają kontekstowe akcje AI.

## Must

- **MUST**: Kontekstowe akcje AI są renderowane w **Menu 3 / command row** po prawej stronie.
- **MUST**: Użyć istniejącego slotu prawego Menu 3 (np. `commandRowRightContent`, `DynamicTabs.rightContent` lub lokalny odpowiednik).

## Must Not

- **MUST NOT**: Dodawać osobnego paska AI pod metadanymi, pod properties strip, na dole canvasu lub wewnątrz głównego obszaru pracy.
- **MUST NOT**: Dublować tej samej akcji AI w Menu 3 i w canvasie.

## Should

- **SHOULD**: Jeśli moduł nie ma prawego slotu Menu 3, najpierw dodać/reużyć taki slot, dopiero potem renderować AI actions.
- **SHOULD**: Workflow actions aktywnego dokumentu mogą stać obok AI actions w tym samym prawym slocie, jeśli zapobiega to kolejnemu toolbarowi.

## Acceptance Criteria

- [ ] W aktywnym module istnieje dokładnie jedno miejsce, w którym użytkownik oczekuje “AI actions”.
- [ ] Brak duplikacji toolbarów.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Enterprise UI Invariants §7)
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`

