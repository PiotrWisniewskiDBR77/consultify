# Dyżur 357 — R1: rodzina sześciu wierszy „Zobaczysz inaczej”

Pomiar wykonano na markerze `29fcbd4de20ca26d2febc50d9455128cab47ffce`.

| Wiersz wejściowy | Pozycja | Za flagą? | Flaga i domyślna wartość | Dowód |
| ---: | --- | --- | --- | --- |
| 388 | Chat / menu Czatu | NIE | brak flagi tej zmiany | `src/components/AIChat/ToolsMenu.tsx:35,122-130` montuje menu i wywołuje synchronizację; `src/services/chatSuggestionsPreference.ts:36-46,57-62` wykonuje odczyt/zapis bez bramki funkcyjnej. |
| 389 | Chat / panel wiadomości | NIE | brak flagi; zmiana usuwa martwe poddrzewo | commit `1c4b5a5635` usuwa równoległe pliki; nie ma alternatywnej ścieżki do włączania flagą. |
| 390 | My Work / Idee/Notatnik | TAK | `ff_idea_notebook_right_panel_prototype`, domyślnie `false` | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts:1,27`; przy OFF bramka zwraca `legacy`: `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx:97`. Obaj żywi konsumenci przechodzą przez tę bramkę: `src/components/MyWork/notebook/NotebookRightRail.tsx:1038` i `src/components/standard/IdeaRightPanel.tsx:422`; brak ścieżki omijającej bramkę. |
| 391 | Interview / karty | NIE | brak flagi tej zmiany | SSOT akcji jest eksportowany bez bramki w `src/components/Interview/interviewActionMatrix.ts:28`; konsumenci importują go bez warunku flagi, m.in. `InterviewHub.tsx:151`. |
| 392 | Tools / SWOT | TAK | `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`, domyślnie OFF | `src/utils/dynamicSwotSevenStagesFlag.ts:1,7-15`; pakiet już zawiera dopisek „domyślnie OFF”. |
| 393 | Initiatives / karta | TAK | `ff_initiative_sections_complete`, domyślnie OFF | `src/utils/initiativeSectionsCompleteFlag.ts:1,13-15,39`; pakiet już zawiera dopisek „domyślnie OFF”. |

Werdykt H1: **potwierdzona** — obaj żywi konsumenci renderują przez `IdeaNotebookRightPanelPrototypeGate`, a bramka przy OFF zwraca stary panel.

Werdykt H2: **potwierdzona** — spośród wierszy bez istniejącego dopisku OFF tylko wiersz My Work jest objęty flagą domyślnie OFF. Chat/menu, Chat/panel i Interview nie mają flagi tej zmiany; Tools i Initiatives już były opisane jako OFF.
