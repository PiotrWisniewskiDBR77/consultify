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

### RAPORT — Fala 2 (ARTEFAKTY §11.2+§13) · 2026-07-02 · branch `reskin/A1/wave-2` (baza = `reskin/A1/wave-1`, ma Falę 0+1)
**UWAGA baza:** worktree HEAD nie zawierał Fali 0+1 (był na `a2b8b8b06a`). Falę 0+1 (tokeny `c.*`, `selectionTokens.ts`, migracje list) trzyma `reskin/A1/wave-1` (tip `2ba2e31ec8`) — więc branch Fali 2 odgałęziłem od `wave-1`, NIE od HEAD worktree. Koordynator: merguj wave-2 po wave-1.

**Zrobione (5 commitów, 5 plików — artefakt-rekord drawery/modale):**
| Ekran (artefakt) | Plik | Zmiany |
|---|---|---|
| Decision detail modal (C-S) | `DecisionDetailModal.tsx` | pełna powłoka→`c.*`: `bg-white dark:bg-navy-900`→`bg-c-surface`; bordery→`c-border(-subtle)`; teksty→role `c-text/-secondary/-muted`; **crimson-removal**: type-badge `bg-primary-*`→neutral `bg-c-surface-raised`, AI-brief panel crimson→neutral info (Sparkles ikona zostaje), audit-dot→`bg-c-border-strong`; textarea focus `ring-primary-500`→`ring-c-focus`; **approve CTA** navy hardcode→primary `bg-c-text text-c-surface`; status-badge APPROVED/REJECTED/ESCALATED (green/danger/amber) = semantyczne, ZOSTAWIONE |
| Decision preview panel (C-S prawy panel) | `DecisionPreviewPanel.tsx` | lokalne slate/navy→`c.*` (relationTone default, project-pill, due-date trailing, brief-recommendation, AI-strip card, snooze popover, 2× aside `bg-navy-950`→`bg-c-bg`, loading/empty); „Otwórz" focus `ring-primary-500/40`→`ring-c-focus`. **Prymitywy `@/components/shared/PreviewPane` + `ui/*` NIETKNIĘTE** (Fala 0). blue/amber relation-type tony = semantyczne, zostają; `ring-offset-white dark:ring-offset-navy-900` = wzór shared MENU_2/3 (Fala 1), zostaje |
| Decisions form + card + header | `DecisionsPanel.tsx` | inputy/selecty/textarea (×wiele, batch)→`border-c-border bg-c-surface text-c-text placeholder:text-c-text-muted focus:ring-c-focus`; labelki→`text-c-text-secondary`; modale (New/Delegate)→`bg-c-surface`+`c-border-subtle`; close/cancel→tokeny; **navy CTA ×3**→`bg-c-text text-c-surface`; **crimson-removal**: card default `border-l-primary-500`→`border-l-c-border-strong`, type-color `text-primary-600`(Phase Gate)/`text-slate-*`(General)→`c-text-secondary`, project chip crimson→`c-surface-raised`, view-toggle count-badge active `bg-primary-100 text-primary-700`→`bg-c-info/15 text-c-info`, filter-chip active crimson→neutral (`border-c-border-strong bg-c-surface-raised`), filter-dropdown item active crimson→`text-c-text`; **ZOSTAWIONE (brand):** 2× gradient-avatar `from-primary-500 to-crimson-600` (ikona modala = brand moment), 2× semantyczne status-gradienty overdue/critical (danger/amber), LOW priority-badge `bg-slate-100 text-slate-600` (= wartość „neutral" tieru §9.2 ④) |
| Task drawer modal (C) | `TaskDetailModal.tsx` | powłoka+form→`c.*`: `bg-white dark:bg-navy-900`→`bg-c-surface`; inputy `bg-slate-50 dark:bg-navy-950 border-slate-300`→`bg-c-surface-raised border-c-border text-c-text` (batch ×7); labelki→`c-text-secondary`; blue focus `ring-blue-500`→`ring-c-focus`; progress-track/checkbox/checklist/empty→tokeny; **Save CTA** `bg-blue-600`→primary `bg-c-text text-c-surface`. ZOSTAWIONE: blue info-akcenty (progress %, +Add Item, accent-blue-600 slider, danger blocked-reason panel = semantyczne) |
| Notatka editor chrome (B) | `NotebookContent.tsx` | **TYLKO crimson-removal na funkcjach/selekcji** (per brief „NIE przebudowa struktury"): „Convert" btn `bg-primary-500/20`→`bg-c-info/15`, „Retry" link `text-primary-600`→`text-c-info`, code-lang menu **selected** state `bg-primary-500/10 text-primary-700`→neutral `bg-c-surface-raised text-c-text` + check-ikona→`text-c-info`. **ZOSTAWIONE (brand AI = Teresa, per Fala 1):** avatar `from-crimson-500 to-primary-600` (l.2137, 2632), AI-banner gradient (l.2631), panel „AI propose → accept" (l.3080-3112). Underline+indigo tab bar Inbox/Active/All/Today — NIETKNIĘTY (decyzja fundamentu pill/underline, per brief + Fala 1 TODO#1) |

**Reguły migracji (identyczne jak Fala 1):** `bg-white dark:bg-navy-*`→`bg-c-surface`; `text-slate-*`→role `c-text/-secondary/-muted`; `border-slate-*/navy-*`→`c-border(-subtle/-strong)`; focus `ring-primary/ring-blue`→`ring-c-focus`; crimson na selekcji/statusie/funkcji→neutral/`c-info`; primary/navy CTA→`bg-c-text text-c-surface`. `bg-c-info/15` = wzór już używany w src (potwierdzony grep).

**DEFER (NIE ruszone — świadomie):**
1. **Canvas MindMap/ProcessFlow/Whiteboard** (archetyp A / editor-shell) — osobny tor, per brief.
2. **Pre-existing TS errors** — `IdeaProcessFlowTool.tsx`, `IdeaWhiteboardTool.tsx`, `IdeaRecommendationMap.tsx`, `table/__tests__/*` — nietknięte.
3. **`NotebookContent.tsx` pełen slate-sweep** (~185 slate/28 navy, 3505 linii): zrobiłem TYLKO crimson/selekcję (brief: „TYLKO migracja kolorów, NIE przebudowa" + wysokie ryzyko pełnego sweepu bez build-verify w worktree bez node_modules). Pełna migracja neutralnych slate→`c.*` = następna fala/oddzielny commit z build.
4. **`TaskDetailView.tsx`** (6722 linii, ~675 slate/198 navy/150 primary) — poza „drawer/modale"; to pełny widok-artefakt, ogromny; DEFER do dedykowanej sesji z build-verify.
5. **`DecisionsPanelContent.tsx`** — to LISTA (zrobiona w Fali 1), nie artefakt.

**Weryfikacja:** worktree bez node_modules → `npm run build` po stronie koordynatora. Zmiany = wyłącznie klasy CSS (0 zmian logiki/importów). Grep-sanity: 0 `navy-*`/`slate-*`/`primary-*`/`ring-primary`/`bg-white` residuów poza świadomie-zostawionymi (brand-gradienty + semantyczne statusy + spec-neutral LOW badge); 0 literówek w tokenach `c.*` (skan per-plik czysty).
