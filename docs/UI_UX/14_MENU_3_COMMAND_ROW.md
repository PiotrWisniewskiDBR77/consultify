---
uiux_doc_id: UIUX_MENU_3_COMMAND_ROW
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Menu 3 / Command row (dynamic)

## Purpose

Zdefiniować rolę Menu 3 jako jednego dynamicznego rzędu sterowania dla aktywnego modułu/sekcji/dokumentu.

## Applies To

Wszystkie moduły; szczególnie: builder/canvas, huby, N-mode.

## Must

- **MUST**: Menu 3 istnieje jako jeden rząd pod Menu 2 (dynamiczny dla kontekstu).
- **MUST**: Prawy slot Menu 3 jest miejscem dla kontekstowych akcji (w tym AI actions).
- **MUST**: Akcje lifecycle/governance (np. review/approve/generate) są w Menu 3, nie w canvasie.

## Must Not

- **MUST NOT**: Tworzyć dodatkowych toolbarów pod Menu 3 tylko po to, by upchnąć akcje.

## Should

- **SHOULD**: Po lewej są presety/filtry (jeśli dotyczy), po prawej akcje i AI.

## Acceptance Criteria

- [ ] Dla aktywnego kontekstu jest jedno, przewidywalne miejsce na akcje.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Enterprise UI Invariants §7, §9)
- `42_AI_ACTIONS_PLACEMENT.md`

