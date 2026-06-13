# WP M04 — Notatnik (Notebook) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M04-notatnik/KARTA_AUDYTU.md` (ocena 52/100) · **Rozmiar:** L (3–5 dni) · **Żywy bloker:** handoff pół-martwy (toast kłamie) — WSPÓLNA naprawa z M21
**Faza programu:** FAZA 3 (szlif beta) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Rdzeń dojrzały na realnych tabelach (`notebooks`, `notebook_pages`, migracje `20260602_notebook_containers.sql` + `20260306_notebook_pages.sql`, **bez fasady `new Map()`**) — biblioteka L1 (§27 **wzorcowa, A-tier**: `ResizableTable`, filtry scope Wszystkie/Osobiste/Zespołowe, liczniki, RowActionsMenu Menu 1/2/3, RBAC owner-only), edytor TipTap+SlashMenu, konwersje żywe z persystencją (→task/decision/initiative/report/presentation przez `notebookConversionService` + `link_graph_edges`, →Canvas M02), Capture API (web-clip/email/import/upload), 4/5 AI to realny LLM. Live route `my-work/notebook.routes.ts` **czysty** (org+owner+visibility, załączniki guarded 25MB/path-traversal, Capture `visibility='private'`). **Cztery długi:** (1) handoff Radar/Inicjatywy **PÓŁ-MARTWY** — `notebookHandoffService` (619 l.) buduje payload, **0 INSERT**, a FE pokazuje toast „Wysłano do Radar/Inicjatyw” — nic nie powstaje; (2) P1 cross-user wyciek prywatnej notatki przez v8 handoff **NAPRAWIONY** (`notebookHandoffService.ts:322` + `userId` propagowany); (3) auto-klasyfikacja (#9) to keyword-scoring podpięte pod „AI classify”; (4) testy hollow (253 zielone, persystencja+AI 100% mockowane, TipTap+SlashMenu bez testów).

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 3)
- **[P1] handoff Radar/Inicjatywy PÓŁ-MARTWY** — FE toast „Wysłano do Radar/Inicjatyw” (`NotebookContent.tsx:1655,1671`) mimo `0 INSERT` w `notebookHandoffService` (zapis `:429`). Fix: albo realny INSERT (Radar/Inicjatywa faktycznie powstaje), albo usunąć kłamliwy toast. **WSPÓLNA ścieżka handoff z M21 — naprawić RAZ.**
- **[P2] auto-klasyfikacja (#9) mylnie nazwana „AI”** — `notebook.routes.ts:1633-1692` = keyword-scoring, nie LLM. Fix: oznaczyć jako heurystykę lub podpiąć realny LLM.
- **[P3] korupcja „rose”** — codemod `shared`→`sharose` (`AIChatInlinePanel.tsx:3,449,497,500`) + 18 hardkodów palety (`:97-99,392,442,565,614`). Quick-fix `sharose`→`shared` + tokeny.
- **[P3] toasty EN-only** — `NotebookContent.tsx:903,912`; i18n `isPl`/`isPolish` → `t()` (sweep FAZA 4).

### (b) BACKEND / API (FAZA 3)
- **[P2] search project-leak** — `/api/v8/notebook/search` (`notebookSearchService.ts:188-196`) zwraca `visibility='project'` bez `project_members` (warunek tylko `project_id IS NOT NULL`) → wyciek tytułów/snippetów między zespołami w org. Fix: `project_members` check.
- **[P3] `/handoff/validate` bez autoryzacji obiektu** (czysta walidacja kształtu); prompt-injection przez treść w extract-actions (bounded — propozycje za zgodą).

### (c) INTEGRACJA / TESTY (FAZA 3 + 4)
- **[MARTWY] `KnowledgePulse.tsx`, `notebook/InsertMenu.tsx`** — 0 importerów (Reports używa `BlockInsertMenu`). Wytnij.
- **[P0 testowy] TipTap autosave + SlashMenu = ZERO testów** (S3/S4); S5 ekstrakcja AI to **fałszywa zieleń** (INSERT proposala klienta). Dodać realne testy edytora + roundtrip DB.
- **[P1 testowy] 8× `it.todo`→realne** + realny handoff konwersji + Capture ingest + E2E core-flow. + fix dedup klucza `backlink-1` (React warning).
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0; zero E2E (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 3, P1 — WSPÓLNE z M21)** Naprawa handoff PÓŁ-MARTWEGO — realny INSERT (Radar/Inicjatywa powstaje) ALBO usunięcie kłamliwego toastu. Koordynacja z WP M21 (jedna ścieżka). Weryfikacja: toast zgodny z efektem.
2. **(FAZA 3)** `project_members` check w v8 search — notatka projektowa bez membership niewidoczna.
3. **(FAZA 3)** Auto-klasyfikację oznaczyć jako heurystykę (lub podpiąć LLM); `/handoff/validate` — rozważyć autoryzację obiektu.
4. **(FAZA 3)** Korupcja „rose” `sharose`→`shared` + 18 hardkodów palety → tokeny; toasty EN-only → `t()`; wytnij `KnowledgePulse`/`InsertMenu`; fix dedup `backlink-1`.
5. **(testy)** Realne testy TipTap autosave + SlashMenu (S3/S4); roundtrip DB (schema-drift); S5 ekstrakcja AI bez fałszywej zieleni; 8 `it.todo`→realne; Capture ingest; realny handoff konwersji.
6. **(FAZA 4)** Żywe 8 scenariuszy z reloadem (S3 autosave→trwałość, S6 konwersje realny vs toast, handoff Radar — czy nic nie powstaje, auto-klasyfikacja AI vs heurystyka). **(FAZA 3-Railway)** migracje `notebooks`/`notebook_pages` + smoke.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** handoff żywy (realny INSERT) lub toast usunięty — zero kłamliwego toastu; konwersje + Capture trwałe po reload.
2. **Bezpieczeństwo:** v8 handoff owner/visibility scoped (już naprawione, z testem cross-user); v8 search z `project_members` check; live route czysty (już).
3. **i18n:** `t()` pełne (koniec `isPl`/`isPolish` inline, toasty EN-only).
4. **Tokeny:** korupcja „rose” usunięta; 18 hardkodów palety → tokeny.
5. **§27:** biblioteka L1 wzorcowa (już A-tier) — utrzymać; Archive bez backendu („Wkrótce”) świadomie zaślepione.
6. **E2E w PR-gate:** TipTap autosave + SlashMenu + handoff owner-check zielone na `Londyn`.

## 5. Weryfikacja
- Handoff: kliknij „Wyślij do Radar/Inicjatyw” → albo encja realnie powstaje, albo brak toastu „Wysłano”.
- v8 handoff cudzej prywatnej notatki → 403/404 (test cross-user, P1 read-only proof na staging).
- v8 search: notatka projektowa bez membership → niewidoczna.
- S3: strona TipTap → autosave → reload → trwała.
- Auto-klasyfikacja: nazwa zgodna z mechanizmem (heurystyka vs LLM).
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- **handoff PÓŁ-MARTWY = WSPÓLNA ścieżka z M21 Meeting** — naprawić RAZ w `notebookHandoffService`/wspólnym handoff (INTEGRACJE.md §C poz.2 / Sprint 4 / W6). Koordynacja z WP M21.
- Konwersje (wyjścia) dotykają M17/M03/M13/M02 — bez zmiany kontraktu.
- CI PR-gate dla `Londyn` + E2E core-flow — systemowe (FAZA 4).
