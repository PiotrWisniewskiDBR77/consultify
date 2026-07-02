# ZLECENIE — Agent A1 · Klaster: My Work
**Wznów:** czytaj [`_PROTOKOL.md`](_PROTOKOL.md) → to zlecenie → [`_STATUS.md`](_STATUS.md) → spec.
**Branch/worktree:** `reskin/A1/wave-<n>`

## Własność wyłączna (pliki)
`src/components/MyWork/**` (Ideas: Mind Map/Process Flow/Whiteboard/Table · Notebook · Tasks · Decisions · Inbox · Calendar · Notifications)

## Zadania per fala
- **Fala 1 (Listy §14):** tabele Tasks, Decisions, Notebook-list, Ideas-list, Inbox, Notifications → Parity Gate §14.7. UWAGA: MyWork to REFERENCJA — część już zgodna; doprowadź resztę + migruj slate→c.* + selection=neutral.
- **Fala 2 (Artefakty §11.2+§13):** Notatka (B) · Task/Decision (C-S drawer) · Mind Map/Process Flow/Whiteboard (A, na editor-shell z Fali 0) · Idea Table (D).
- **Fala 3 (Instrumenty §15):** TasksKanbanBoard · DecisionsKanbanBoard · NotificationsKanbanBoard · Focus board.
- **Fala 5 (Light):** przejście całego klastra w light, korekta antywzorców.

## Znane bugi do zabicia (z walkthrough)
- Notebook Menu 2 pill regresja (A-2) · Notebook kebab ubogi (A-6) · Notebook edytor „dramat" → przebudowa artefaktu (Fala 2) · multi-select (A-1) · przypisanie do folderów bez 2 dodatkowych linii menu.

## RAPORTY (dopisuj po każdym ekranie)
<!-- Fala X · ekran · pliki · DoD · pominięte -->

### RAPORT — Fala 1 (LISTY) · 2026-07-02 · branch `reskin/A1/wave-1` (worktree agent-afb63de0c223851a7)
**Zrobione (7 commitów, 8 plików):**
| Ekran | Plik | Zmiany |
|---|---|---|
| Tasks table | `MyTasksListContent.tsx` | pełna migracja navy/slate/primary→`c.*` (nagłówki→`text-c-text-muted`, tytuł→`text-c-text`, kontener/thead→`bg-c-surface`+`border-c-border-subtle`, tło→`bg-c-bg`); sort/filter-active `text-primary-500`→`text-c-text-secondary`; hover-ring chipów→`ring-c-focus`; checkboxy→`bg-c-text/text-c-surface` (neutral, high-contrast); focus-within→`border-c-focus-solid` |
| Decisions table | `DecisionsPanelContent.tsx` | **SYS-1 fix:** selection wiersza była CRIMSON (`bg-primary-500/8`+lewy pasek `bg-primary-500`) → zastąpiona współdzieloną `SELECTED_ROW_CLASS` (selectionTokens); avatar gradient crimson→neutral chip; popover kolumn→`bg-c-surface-raised`; reszta jak Tasks |
| Notebook list | `NotebookLibraryContent.tsx` | tabela+skeleton+empty+modal→`c.*`; tytuł wiersza `font-medium slate-800`→`text-sm font-semibold text-c-text` (§14.2); scope-selected w modalu crimson→neutral (`border-c-border-strong bg-c-surface-raised`); primary button navy/hex→`bg-c-text text-c-surface`; focus ring→`ring-c-focus` |
| Ideas list (tabela) | `IdeasTableContent.tsx` | **SYS-1 fix:** pasek akcentu zaznaczenia/fokusa `bg-primary-500/600`→`bg-c-info`; checkbox natywny crimson→`c-info`+`ring-c-focus`; thead→`bg-c-surface-raised`; wiersz `bg-white dark:navy-950`→`bg-c-surface`; tool-badges→`c.*` |
| Ideas list (pool) | `MyIdeasListContent.tsx` | chipy/karty/modale/grupy/inputs→`c.*`; ring zaznaczenia karty→`ring-c-border-strong`; focus ring amber→`ring-c-focus` |
| Inbox | `InboxContent.tsx` | SLA/typ pille→`border-c-border bg-c-surface-raised text-c-text-secondary`; heat-bordery→`border-l-c-border*`; thead/wiersze/karty→`c.*`; sort/filter-active→bez crimson; checkboxy neutral; hover crimson (mark-read)→neutral |
| Notifications | `NotificationsContent.tsx` | **SYS-1 fix:** selection crimson→`SELECTED_ROW_CLASS`; checkbox `bg-primary-500`→`bg-c-text`; mute-popover/toolbar/grupy→`c.*` |
| Chrome list (hub) | `MyWorkHub.tsx` | 8× `focus-visible:ring-primary-500/40`→`ring-c-focus` (wyłącznie fokus; nic więcej nie ruszone) |

**Świadomie ZOSTAWIONE (nie-bugi):**
- `hover:bg-slate-50/70 dark:hover:bg-white/[0.03]` na wierszach = dokładna wartość specu §14.2 (hover) — zostaje.
- Neutralne kropki danych `bg-slate-400/500` (priority/status dot, INLINE_*_OPTIONS) = zgodne z `MENU_3_ALL_DOT_CLASS` w shared — zostają do decyzji fundamentu.
- Sort-icon inactive `text-slate-300 dark:text-slate-600` (celowo bledszy niż muted) — brak tokenu o tej roli; do fundamentu.
- Crimson jako BRAND (celowe wg komentarzy kanonu w kodzie): chip `promoted` + ikona mindmap (`var(--c-accent)` SSOT) w Ideas; AI-chipy/Sparkles (Teresa brand) w Inbox/Ideas; primary CTA „New idea"; aktywne filter-chipy = ten sam wzór co shared `MENU_3_CHIP_ACTIVE`/`MENU_2_TAB_ACTIVE` (shared poza moim zakresem).
- `shadow-slate-900/12` (barwa cienia, nie powierzchnia) w popoverze Decisions.
- `ring-offset-white dark:ring-offset-navy-900` = wzór z shared MENU_2/MENU_3 — spójność z shared.

**TODO / dla koordynatora:**
1. **A-2 Menu 2 pill Notebook:** taby modułu w MyWorkHub JUŻ są pill (`MENU_2_TAB_*`). Kandydat regresji = underline+indigo tab bar Inbox/Active/All/Today w sidebarze `NotebookContent.tsx` (~l. 2186-2245) — to wnętrze artefaktu Notatki (przebudowa = Fala 2), nie ruszałem.
2. Crimson focus/inputs w drawerach/modalach klastra: `DecisionsPanel.tsx` (formularz, 8×), `DecisionDetailModal.tsx`, `DecisionPreviewPanel.tsx` — to artefakty C-S (Fala 2).
3. `MyWorkHub.tsx` ma jeszcze ~23 navy-* w chrome huba (segmenty, selecty) — hub jako całość poza Falą 1-listy; zrobiłem tylko fokus.
4. Multi-select (A-1): wszystkie 6 list P1 MA działający selection+bulk (checkboxy + bulk bar przez `onBulkBarChange`/Menu 3) — brak martwych przypadków w MyWork; nic do spinania.
5. Weryfikacja: worktree bez node_modules → `npm run build` po stronie koordynatora (zmiany = wyłącznie klasy CSS + 2 importy `SELECTED_ROW_CLASS` z istniejącego `selectionTokens.ts`; grep-sanity na literówki/navy = czysty).
