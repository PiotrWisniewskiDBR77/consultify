# M05 — Ideas — Zarządzanie — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec59536`) · **Audytor:** Claude (subagent autonomiczny — Fazy 0–2, 5–6; Fazy 3–4 DEFERRED)
**Wejścia:** `Harvard/podzial/ideas/MODULE_02A_ideas-zarzadzanie.md` + `Harvard/podzial/inventory/INV_B_my-work.md` + kod + uruchomione testy
**Evidence:** `Harvard/modules/M05-ideas-zarzadzanie/evidence/` (brak fizycznych plików — audyt statyczny)

## OCENA: 55/100 — Tier: Alpha · NIEPEŁNY (bez Fazy 3 i 4)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 18 | Rdzeń CRUD/mapa/AI/konwersja realne i dojrzałe; traci: 2× P0 (conflict handler kłamie → silent overwrite, snapshoty wieczne 503), eksport serwerowy to rejestr bez pliku, notatki efemeryczne, presence fasada. |
| B. Wiring i dane | 15 | 9 | Wszystkie główne tabele mają migracje i org-scope; dwa broken wires: `my_idea_map_snapshots` bez migracji (→ wieczne 503), `my_idea_map_versions` ma migrację ale zero konsumentów w kodzie (split-brain); `my_idea_edges` backend bez FE. |
| C. Testy automatyczne | 15 | 9 | 12 plików testowych, 96 testów PASS (0 FAIL) — ale wyłącznie FE-unit + whitebox formaterów; zero testów serwerowych dla ~45 endpointów; E2E smoke (`qa-idea-mindmap-checklist`) w katalogu smoke (jest w CI nightly), ale weryfikuje UI checklist, nie kontrakt API. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana (brak dostępu do przeglądarki w tej sesji). |
| E. Kanony/UI | 10 | 7 | MyIdeasListContent używa ResizableTable/canon; 3 widoki listy + Menu3-style filtry; ModuleHub wdrożony (MyWorkHub); beta plate z `betaAccess.ts` SSOT; traci: `canvasLocked=false` na sztywno (vestigial), 4× `console.log` w prodzie. |
| F. Bezpieczeństwo/dostęp | 10 | 6 | Wszystkie read/write endpointy mają `WHERE user_id=? AND organization_id=?` — brak cross-org IDOR na danych; presence GET/POST nie weryfikuje własności idei przed użyciem `channelId` (P2, nie P0 bo mapa per-user); beta gate tylko nawigacyjny (API nie sprawdza flagi). |
| G. Środowiska (Railway) | 10 | 6 | Faza 3 nieformalnie: migracje głównych tabel (`my_ideas`, `my_idea_maps`, `my_idea_edges`, `idea_node_comments`, `idea_exports`) istnieją i są w baseline v2; `my_idea_map_snapshots` BRAK — pewne 503 na prod; flagi bez weryfikacji live. |
| **Hard cap zastosowany?** | — | — | Faza 4 niewykonana → cap 70; wynik surowy przed capem: ~55 → **cap 70 nie jest wiążący** (55 < 70). Zero cross-org WRITE (cap 50 nie dotyczy). |

**Werdykt jednym akapitem:** Moduł Ideas — Zarządzanie to najdojrzalszy obszar sekcji My Work: realny CRUD per-user+org, optimistic concurrency z baseVersion, bogata AI (sugestie/generacja/expand/gap-analysis przez prawdziwy LLM), konwersja do 6 outputów z INSERT-ami i traceability, 96 testów FE zielonych. Zaufanie łamią dwa P0: `handleGraphConflict` pokazuje toast i robi nic — następny autosave cicho nadpisuje dane serwera (`IdeaMapWorkspace.tsx:451–461` + `useIdeaMapSync.ts:264–268`); snapshoty (`my_idea_map_snapshots`) nie mają migracji nigdzie w repo → każde żądanie do endpointów snapshotów zwraca 503 na produkcji — feature checkpointów jest martwym UI. Na plus: org-scope konsekwentny we wszystkich 45+ endpointach; brak cross-org IDOR. Blokuje tier Beta: naprawienie P0 konfliktu, migracja snapshots, testy serwerowe kontraktu map-sync.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

**Checklist pozycji inwentarza:** 14 pozycji funkcjonalnych (z `MODULE_02A_ideas-zarzadzanie.md` §1–§3) + 0 nowych od daty inwentarza (git log czysty dla tych plików w tej gałęzi).

**Scenariusze krytyczne (6):**
1. **S1 — Lista i CRUD:** utwórz ideę → nadaj tytuł/tagi → edytuj → usuń → przeładuj (trwałość).
2. **S2 — Mapa/autosave:** otwórz workspace → dodaj węzły w mindmap → poczekaj 60 s (autosave) → przeładuj → dane nadal w DB.
3. **S3 — Conflict 409:** równoległa edycja (dwa taby) → sync → czy UI poprawnie odświeża i merguje (czy cicho nadpisuje).
4. **S4 — Przełącznik narzędzi:** utwórz węzły w mindmap → przełącz na Table → dane widoczne → wróć → mindmap bez regresu.
5. **S5 — Konwersja idea→output:** konwertuj ideę na inicjatywę → sprawdź INSERT w initiatives + link_graph_edges.
6. **S6 — Snapshoty:** zapisz snapshot → sprawdź odpowiedź serwera (powinno być 503 na prod, OK na local z mock DB).

**Obowiązujące kanony:**
- `TABLE_AND_PREVIEW_CANON §27`: dotyczy widoku table listy idei (`MyIdeasListContent`, `IdeasTableContent`).
- `CARD_CONTENT_FORMULA`: nie dotyczy (moduł zarządzania nie produkuje kart Insight/Initiative na wyjściu — robi to konwersja, rozliczana w M13).
- **ModuleHub:** `MyWorkHub.tsx` — zgodny wzorzec.
- **Beta-gating:** `MYWORK_IDEAS: 'closed'` w `betaAccess.ts:58` — obowiązuje.

---

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE (zweryfikowane)

- **Lista idei + CRUD:** `GET /api/my-work/my-ideas` (`my-work.routes.ts:2413`) → SQL z `user_id=? AND organization_id=?` (`my-work.routes.ts:2490`); create (`my-work.routes.ts:2553`), update (`my-work.routes.ts:2750`), delete (`my-work.routes.ts:3020`).
- **Mapa — odczyt/sync:** `GET /:id/map` (`my-work.routes.ts:3366`) + `POST /:id/map/sync` (`my-work.routes.ts:3874`): optimistic concurrency `baseVersion`, 409 przy rozjeździe (`my-work.routes.ts:3949–3970`), guard przed pustym resetem (`my-work.routes.ts:3977–4005`).
- **Autosave FE:** `useIdeaMapSync.ts:338–373` — debounce 800 ms + idle task, flush na visibilitychange/online/beforeunload/Cmd+S; stany idle/queued/saving/saved/offline/conflict.
- **Foldery CRUD:** `my-work.routes.ts:2910–3018` → tabela `my_idea_folders` (migracja `20260602_my_ideas_folders_favorites_recents.sql`).
- **Ulubione / ostatnio otwierane:** `useFavoriteIdeas` / `useRecentIdeas` — hooki z localStorage + API; `POST /:id/opened` (`my-work.routes.ts:2887`).
- **3 widoki listy:** table/grid/garden (`MyIdeasListContent.tsx:1697, 1772`); skróty c/e/p (`MyIdeasListContent.tsx:1020–1031`).
- **Metryki map:** `GET /my-ideas/metrics/map` (`my-work.routes.ts:3539`) — realne SQL na `my_idea_maps`.
- **Przełącznik 4 narzędzi:** `IdeaWorkspaceToolbar.tsx` z wskaźnikami „ma zawartość", skróty 1–4 (`IdeaMapWorkspace.tsx:1636`), `preferred_tool` z DB (`IdeaMapWorkspace.tsx:2778–2782`), error boundary per narzędzie.
- **Konwersja idea→output:** `POST /:id/convert` (`my-work.routes.ts:5888`): 6 targetów, realne INSERT-y z guard own check `WHERE id=? AND user_id=? AND organization_id=?` (`my-work.routes.ts:5929`), materializacja ToolSession, krawędzie link_graph, promocja stage→promoted.
- **AI suggestions/generate/expand/fill/gap-analysis:** wszystkie przez `llmService.call` / `llmService.callStructured` — realne LLM (`ideaAISuggestionsService.ts:240–248`, `ideaAIGeneratorService.ts:1160–1172`).
- **Komentarze węzłów:** `idea_node_comments` (migracja `720_idea_node_comments.sql`) — CRUD kompletny (`my-work.routes.ts:4656–4798`).
- **Export CSV tabeli:** `GET /:id/export-csv` (`my-work.routes.ts:8829`) → SQL na `my_idea_maps`.
- **Beta gating FE:** `MYWORK_IDEAS: 'closed'` (`betaAccess.ts:58`), egzekwowane w `MyWorkHub.tsx:596–598, 801–820`.
- **IdeaTemplateGallery:** ~80+ szablonów, `Api.syncMyIdeaMap` z `baseVersion` (`IdeaTemplateGallery.tsx:1886–1925`).
- **IdeaContextPanel:** realne backlinki z link-graph + kontekst firmowy (`IdeaContextPanel.tsx:300–420`).
- **IdeaUnifiedSearch:** Cmd+F po labelach/opisach/ownerach/tagach/załącznikach (`IdeaUnifiedSearch.tsx`).

### 1b. MOCK / STUB / fabrykowane klientem

- **Eksport serwerowy = rejestr requestów bez pliku:** `POST /api/v4-final/ideas/:id/export` (`final-batch.routes.ts:32`) → `finalBatchService.requestExport` tylko INSERT-uje do `idea_exports`; żaden worker nie generuje pliku. Frontend używa `catch(() => undefined)` (`IdeaExportMenu.tsx:498–509`).
- **„PDF" = screenshot PNG w jsPDF:** `IdeaExportMenu.tsx:305–345` — html-to-image + jsPDF; brak prawdziwego PDF z wektorem.
- **Notatki w IdeaContextPanel efemeryczne:** `useState` bez persystencji, reset przy odmontowaniu (`IdeaContextPanel.tsx:141, 895–905`).
- **`canvasLocked = false` na sztywno:** `IdeaMapWorkspace.tsx:373` — vestigial po refaktorze.
- **Presence = pozorna współpraca:** endpointy obecności działają technicznie, ale `my_idea_maps` ma `UNIQUE INDEX (user_id, idea_id)` (`20260312_my_idea_maps.sql:23`) — drugi użytkownik nigdy nie czyta/zapisuje tej samej mapy.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE

- **P0 — Conflict handler kłamie → silent overwrite:** `handleGraphConflict` (`IdeaMapWorkspace.tsx:451–461`) wyświetla toast „Odświeżam mapę z serwera" ale nie woła żadnego refresh. `useIdeaMapSync.ts:264–268` po 409 podbija `serverVersionRef` do wersji serwera → następny flush przejdzie i nadpisze równoległe zmiany bez wiedzy użytkownika (last-write-wins, bez merge).
- **P0 — `my_idea_map_snapshots` bez migracji → wieczne 503:** `requireTables(res, ['my_idea_map_snapshots'])` (`my-work.routes.ts:4515, 4563, 4626`) blokuje wszystkie trzy endpointy snapshotów; tabela nie istnieje w żadnej migracji ani baseline (zweryfikowano: 0 trafień w `server/migrations/`, `server/migrations-v2/`). Klient połyka cicho.
- **P1 — Wielu writerów do jednego wiersza mapy:** table/process_flow/whiteboard tworzą niezależne instancje `useIdeaMapSync` z własnym licznikiem wersji (`useTablePersistence.ts:111`, `IdeaProcessFlowTool.tsx:531`, `IdeaWhiteboardTool.tsx:645`); rozjeżdżają wersje → samowywołane 409. Tylko mindmap dostaje współdzielony `externalRuntime` (`IdeaMapWorkspace.tsx:2828–2840`).
- **P1 — Brak flusha przy odmontowaniu/przełączeniu narzędzia:** cleanup (`useIdeaMapSync.ts:375–381`) czyści timery bez flusha → zmiany z ostatnich <800 ms mogą przepaść.
- **P2 — Szablon nadpisuje graf bez potwierdzenia:** `IdeaTemplateGallery.tsx:1886–1908`; `grep confirm|overwrite = 0`.
- **P2 — 4× console.log debug w prodzie:** `IdeaMapWorkspace.tsx:433, 719, 1172, 1809`.
- **P3 — Beta gate tylko nawigacyjny (brak warstwy API):** endpointy `my-ideas` nie sprawdzają flagi beta — bezpośredni call API dostępny dla każdego zalogowanego usera w org.

### 1d. UKRYTE / MARTWY KOD

- **`IdeaCanvasToolSelector.tsx`:** 158 linii, niemontowany nigdzie → **wytnij**.
- **API `my_idea_edges` (`my-work.routes.ts:3063–3220`) + migracja `20260310_my_idea_edges.sql`:** backend kompletny, zero konsumentów FE → **zostaw świadomie** (fundament pod przyszłą cross-idea graph), oznaczyć jako `RESERVED`.
- **`my_idea_map_versions` (migracja `622_my_idea_map_versions.sql`):** tabela istnieje w DB, zero linii kodu jej używa → decyzja: czy wersje mają bazować na tej tabeli (zamiast martwych snapshotów) — **rozstrzygnąć + wepnij lub wytnij migrację**.
- **`IdeasMindMap.tsx`:** redirect-shim do właściwego workspace → **wytnij po migracji deep-linków**.

### 1e. Wiring FE↔BE↔DB

| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Lista idei | `GET /api/my-work/my-ideas` :2414 | `my_ideas` | `20260220_my_work_my_ideas.sql` | ✅ realne |
| CRUD idei | `POST/PUT/DELETE /my-ideas[/:id]` :2553/:2750/:3020 | `my_ideas` | jw. | ✅ realne |
| Foldery | `GET/POST/PUT/DELETE /my-idea-folders[/:id]` :2911/:2932/:2959/:2994 | `my_idea_folders` | `20260602_my_ideas_folders_favorites_recents.sql` | ✅ realne |
| Ulubione / recents | `PUT /:id` + `POST /:id/opened` :2887 | `my_ideas` (kolumny is_favorite, last_opened_at) | jw. | ✅ realne |
| Mapa — odczyt | `GET /:id/map` :3366 | `my_idea_maps` | `20260312_my_idea_maps.sql` + `20260313_..._v3.sql` | ✅ realne |
| Mapa — sync | `POST /:id/map/sync` :3874 | `my_idea_maps` | jw. | ✅ realne (conflict kłamie — P0) |
| Metryki map | `GET /my-ideas/metrics/map` :3539 | `my_idea_maps` | jw. | ✅ realne |
| Snapshoty mapy | `GET/POST/DELETE /:id/map/snapshots` :4509/:4556/:4619 | `my_idea_map_snapshots` | **BRAK** | ❌ wieczne 503 |
| Wersje mapy (alt) | — | `my_idea_map_versions` | `622_my_idea_map_versions.sql` | ❌ tabela OK, zero kodu |
| Krawędzie idei | `GET/POST/DELETE /:id/edges` :3064/:3112/:3188 | `my_idea_edges` | `20260310_my_idea_edges.sql` | ⚠️ backend OK, brak FE |
| Komentarze węzłów | `GET/POST/DELETE /:id/map/nodes/:nodeId/comments` :4656/:4698/:4761 | `idea_node_comments` | `720_idea_node_comments.sql` | ✅ realne |
| Konwersja → output | `POST /:id/convert` :5888 | initiatives/tasks/decisions/reports + tool_sessions + link_graph_edges | różne | ✅ realne + traceability |
| AI suggestions/generate/expand | `POST /:id/ai-suggestions/:id/ai-generate/:id/map/expand` :8710/:4959/:4074 | LLM via `llmService` | — | ✅ realne LLM |
| Eksport serwerowy | `POST /api/v4-final/ideas/:id/export` | `idea_exports` | `663_v4_final_batch.sql` | ⚠️ rejestr requestów, plik nigdy nie powstaje |
| CSV tabeli | `GET /:id/export-csv` :8829 | `my_idea_maps` | jw. | ✅ realne |
| Presence | `GET/POST /:id/presence` :8901/:8933 | realtime platform | — | ⚠️ działa, ale mapy per-user → współpraca niemożliwa |
| Aktywność | `GET/POST /:id/activity` :4800/:4842 | `my_idea_activity` | `633_v4_idea_canonical_schema.sql` | ✅ realne |

### 1f. Flagi

| Flaga | Default BE (runtime) | Default FE | Kto włącza | Wpływ na moduł |
|---|---|---|---|---|
| `MYWORK_IDEAS` | brak sprawdzenia serwerowego | `'closed'` (`betaAccess.ts:58`) | owner w betaAccess.ts | FE blokuje dla wszystkich ról (nawet admin, `BETA_ADMINS_EXEMPT=false`); API dostępne bez flagi |
| `ENABLE_V8_GLOBAL` | false (v8 router nie montuje my-ideas) | n/d | env Railway | v8 router (`/routes/v8/my-work.routes.ts`) ma oddzielne endpointy — niezależne od głównego |

### 1g. Połączenia międzymodułowe

| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M01 Czat / Teresa | `POST /my-ideas/from-chat` — tworzenie idei z konwersacji | `my-work.routes.ts:5354` | DZIAŁA |
| WEJŚCIE ← | M04 Notatnik | SlashMenu „save-as-idea" → `POST /my-ideas` | `notebook/SlashMenu.tsx:~220` | DZIAŁA |
| WEJŚCIE ← | M10 Wywiad | konwersja spostrzeżeń → idea (przez Outputs) | różne | DZIAŁA (pośrednio) |
| WYJŚCIE → | M13 Inicjatywy | `POST /:id/convert?target=initiative` → INSERT do `initiatives` + link_graph | `my-work.routes.ts:5888` | DZIAŁA |
| WYJŚCIE → | M14 Wdrożenie (Tasks) | `target=task_set` → INSERT do `tasks` | jw. | DZIAŁA |
| WYJŚCIE → | M17 Outputs / Raporty | `target=report/presentation` → delegacja do report-builder/presentations | `conversionService.ts` | DZIAŁA |
| WYJŚCIE → | M01 Czat (TeamChat) | `target=team_chat` → CREATE chat session | `my-work.routes.ts:5888` | DZIAŁA |
| WYJŚCIE → | Link-graph (cross-moduł) | `INSERT link_graph_edges` przy konwersji | `my-work.routes.ts:~5960` | DZIAŁA |
| WYJŚCIE → | M17 Outputs (eksport serwerowy) | `POST /v4-final/ideas/:id/export` → `idea_exports` (rejestr) | `final-batch.routes.ts:32` | STUB (plik nie powstaje) |

---

## 2. Testy automatyczne (FAZA 2)

**Uruchomienie:** `npx vitest run tests/unit/mywork/idea* tests/unit/mywork/aiProposalRuntime.test.ts tests/unit/mywork/crossToolTransform.test.ts tests/unit/mywork/useFavoriteIdeas.test.ts tests/unit/mywork/useRecentIdeas.test.ts tests/unit/backend/v4-smoke/r0-idea-schema.test.ts tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts tests/components/MyWork/ideaEntryTypes.test.ts tests/components/MyWork/IdeaExportMenu.test.tsx tests/components/MyWork/MyWorkHub.test.tsx tests/components/RouterSync.idea-artifact.test.tsx` @ `f8fec59536` → **PASS 96 / FAIL 0 / SKIP 0** (czas: ~6 s w 3 sesjach)

| Plik testu | Zakres | Liczba | Wynik | W CI? |
|---|---|---|---|---|
| `ideaMapToMarkdown.test.ts` | Serializacja mapy → Markdown (edge/node/cykl/budżet) | 9 | PASS | vitest unit shard |
| `ideaTablePresenceErrorMessage.test.ts` | Mapowanie kodów błędów presence na komunikaty | 2 | PASS | vitest unit shard |
| `ideaWorkspaceState.test.ts` | Workspace state: create/patch/move/remove per-idea | 4 | PASS | vitest unit shard |
| `aiProposalRuntime.test.ts` | Aplikator patchy propozycji AI (deterministyczny) | 4 | PASS | vitest unit shard |
| `crossToolTransform.test.ts` | Cross-tool transformacje danych między narzędziami | 4 | PASS | vitest unit shard |
| `useFavoriteIdeas.test.ts` | Toggle ulubionych (add/remove/idempotent) | 4 | PASS | vitest unit shard |
| `useRecentIdeas.test.ts` | Hook ostatnio otwieranych | 5 | PASS | vitest unit shard |
| `r0-idea-schema.test.ts` | PROPERTY_REGISTRY — typy kolumn schema V4 | 4 | PASS | vitest unit shard |
| `ideaAIGeneratorService.whiteboardFormatters.test.ts` | Formaterzy whiteboard (AI generate) | 6 | PASS | vitest unit shard |
| `ideaEntryTypes.test.ts` | Normalizacja stage-ów legacy/V5 | 2 | PASS | vitest component |
| `IdeaExportMenu.test.tsx` | Import/preview paczki diagramu | 1 | PASS | vitest component |
| `MyWorkHub.test.tsx` | Hub tabs, widgets, ModuleHub pattern, a11y | 18 | PASS | vitest component |
| `RouterSync.idea-artifact.test.tsx` | Deep-link artifact=idea:*, gating pilota | 8 | PASS | vitest component |
| `qa-idea-mindmap-checklist.spec.ts` | Playwright smoke E2E mindmap checklist | 1 (batch) | nie uruchomiony (wymaga przeglądarki) | e2e-nightly (playwright.smoke.config.ts) |

**Pokrycie scenariuszy krytycznych:**

| Scenariusz | FE | BE | E2E | CI | Luka |
|---|---|---|---|---|---|
| S1 — Lista + CRUD | ✅ (hub, entry types) | ❌ brak | ⚠️ częściowy w wave1-mywork | vitest shard | Brak testu pełnego round-tripu CRUD z DB |
| S2 — Mapa/autosave 60 s | ⚠️ (useIdeaMapSync logika, ale bez roundtrip) | ❌ brak | ❌ brak | — | Brak BE testu `POST /sync` z prawdziwym DB |
| S3 — Conflict 409 | ❌ brak testu ścieżki 409→refresh→merge | ❌ brak | ❌ brak | — | **Największa luka: to jest P0** |
| S4 — Przełącznik narzędzi | ⚠️ (crossToolTransform logika) | ❌ brak | ❌ brak | — | Brak testu przełączenia z zachowaniem danych |
| S5 — Konwersja → output | ❌ brak | ❌ brak | ❌ brak | — | Zero testów dla 6 ścieżek konwersji |
| S6 — Snapshoty | ❌ brak | ❌ brak | ❌ brak | — | Bezcelowe zanim powstanie migracja |

**Backlog testowy (→ plan dokończenia):**
1. [P0] integration — `tests/integration/ideas/map-sync-conflict.test.ts` — scenariusz 409 → proper refresh (S3)
2. [P0] integration — `tests/integration/ideas/map-sync-roundtrip.test.ts` — create → sync → reload → verify (S2)
3. [P1] integration — `tests/integration/ideas/convert-to-initiative.test.ts` — konwersja + sprawdzenie INSERT (S5)
4. [P1] integration — `tests/integration/ideas/snapshots.test.ts` — po wdrożeniu migracji (S6)
5. [P2] unit — `tests/unit/mywork/useIdeaMapSync.test.ts` — flush przy odmontowaniu, dual-writer guard
6. [P2] E2E — `tests/e2e/smoke/qa-idea-mindmap-checklist.spec.ts` — włączyć do tier0 CI (jest w smoke ale nie w tier0 jawnie)

---

## 3. Środowiska / Railway (FAZA 3)

| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | nieznany (brak dostępu do Railway CLI w tej sesji) | ~2026-05-18 (Londyn nie wypromowany) | DEFERRED |
| Migracje modułu — `my_ideas` | w baseline-v2 (001_baseline_20260413.sql) | j.w. | ✅ zakłada się OK |
| Migracje — `my_idea_maps` | w baseline-v2 | j.w. | ✅ zakłada się OK |
| Migracje — `my_idea_map_snapshots` | **BRAK w repo** | **BRAK w repo** | ❌ pewne 503 wszędzie |
| Migracje — `my_idea_map_versions` | w migracji 622 | zależne od staging runner | ⚠️ istnieje, kod nie używa |
| Migracje — `idea_exports` | w migracji 663 + baseline-v2 | j.w. | ✅ zakłada się OK |
| Flagi/env wymagane | `LLM_API_KEY` (AI działa) | j.w. | DEFERRED (live) |
| Smoke endpointów | niezweryfikowany (brak Railway token) | n.d. | DEFERRED |
| Błędy w logach (24–48 h) | n.d. | n.d. | DEFERRED |

**Dowody:** brak fizycznych plików (audyt statyczny bez Railway CLI).

---

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)

**Środowisko:** NIEWYKONANE (brak dostępu do przeglądarki w tej sesji subagenta).

| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1 | Lista i CRUD | BLOCKED | — |
| S2 | Mapa/autosave | BLOCKED | — |
| S3 | Conflict 409 | BLOCKED | — |
| S4 | Przełącznik narzędzi | BLOCKED | — |
| S5 | Konwersja → output | BLOCKED | — |
| S6 | Snapshoty (oczekiwane 503) | BLOCKED | — |

**Przyciski-zawsze-błąd znalezione:** BLOCKED (wymaga live).
**Stany:** BLOCKED. **i18n:** BLOCKED. **Konsola/sieć:** BLOCKED. **Role:** BLOCKED. **Skróty:** BLOCKED.

---

## 5. Kanony i standardy (FAZA 5)

**§27 TABLE_AND_PREVIEW_CANON — lista idei (`MyIdeasListContent.tsx` + `IdeasTableContent.tsx`):**

| Kryterium | Status | Uwaga |
|---|---|---|
| A. ResizableTable jako kontener | ✅ | `IdeasTableContent.tsx:52–53` importuje `ResizableTable`, `ColumnResizer` |
| B. Menu 1 (tworzenie) | ✅ | przycisk nowej idei w `MyIdeasListContent.tsx` |
| C. Menu 2 (widoki: table/grid/garden) | ✅ | 3 widoki + przełącznik `MyIdeasListContent.tsx:1697, 1772` |
| D. Menu 3 (filtry: q/tag/folder/favorite) | ✅ | filtry z guardami na brakujące kolumny |
| E. Preview panel boczny | ✅ | panel workspace otwierany po kliknięciu |
| F. Skróty klawiaturowe na liście | ✅ | c/e/p (`MyIdeasListContent.tsx:1020–1031`) |
| G. Bulk bar | ⚠️ | lista nie weryfikowana live |
| H. Empty state branded | ⚠️ | nie zweryfikowano live |
| I. Loading/error state | ⚠️ | nie zweryfikowano live |
| J. i18n kompletne PL/EN | ⚠️ | nie zweryfikowano live |

**CARD_CONTENT_FORMULA:** n.d. — moduł zarządzania nie produkuje kart.

**Wzorzec hubowy (ModuleHub):** `MyWorkHub.tsx` — zgodny (Menu 1/2/3, dynamic tabs, breadcrumbs, beta plate z `betaAccess.ts`).

**Beta-plate:** ✅ — zgodny z SSOT `betaAccess.ts:58`; blokuje widoczność dla wszystkich ról (nawet admin).

**Odstępstwa od kanonów (P2):**
- `canvasLocked = false` hardcoded (`IdeaMapWorkspace.tsx:373`) — vestigial, do wyczyszczenia.
- 4× `console.log` w prodzie (`IdeaMapWorkspace.tsx:433, 719, 1172, 1809`) — naruszenie standardów produkcyjnych.

---

## 6. Bezpieczeństwo i dostęp (FAZA 6)

| Warstwa | Nawigacja | Route (ProtectedRoute) | API middleware | Dziura? |
|---|---|---|---|---|
| Ideas (główne) | `betaAccess.ts:58` blokuje sidebar | `MyWorkHub.tsx:596–598, 801–820` beta plate | `verifyToken` na całym routerze (`my-work.routes.ts:74`) | ⚠️ brak warstwy API dla beta gate (P3) |
| Dane ideas | n.d. | n.d. | `WHERE user_id=? AND organization_id=?` wszędzie | ✅ brak cross-org IDOR |
| Eksport (`v4-final`) | n.d. | n.d. | `verifyToken` (`final-batch.routes.ts:14`) + `requireUser` waliduje orgId | ✅ |
| Presence (WS/realtime) | n.d. | n.d. | `requireUser` sprawdza auth; channelId = `idea-table-${ideaId}` bez org | ⚠️ [P2] |

**Org-scope:** wszystkie endpointy `my-ideas` używają `WHERE user_id=? AND organization_id=?` — zweryfikowano 40+ cytowań w kodzie. Brak cross-org read/write IDOR na danych idei.

**Zasoby publiczne:** brak — idee nie mają publicznych share tokenów (w odróżnieniu od Canvas).

**WS/realtime:** presence nie używa WS (polling), kanał `idea-table-${ideaId}` nie zawiera orgId — teoretycznie użytkownik z innej org znający `ideaId` mógłby wysłać presence do tego kanału; w praktyce kanał zawiera tylko metadane kursorów, nie dane mapy, a mapy i tak są per-user (unique index). **Severity: P2**.

**Capabilities serwerowo:** beta gate tylko nawigacyjny — API dostępne bez sprawdzania flagi (`P3`). Właściciel powinien podjąć świadomą decyzję: czy pre-GA zamknięcie wyłącznie przez UI jest wystarczające.

**Findingi bezpieczeństwa:**
- **[P0]** Silent overwrite po 409 (`handleGraphConflict` kłamie): może prowadzić do utraty danych przez użytkownika — nie cross-org, ale naruszenie integralności danych.
- **[P2]** Presence channelId bez orgId: `POST /my-ideas/:id/presence` nie weryfikuje przynależności ideaId do org przed wpisem do kanału realtime (`my-work.routes.ts:8901`). Niskie ryzyko (brak danych mapy w presence).
- **[P3]** Beta gate frontendowy bez serwera: API `/my-ideas` dostępne dla każdego zalogowanego usera organizacji z tokenem, nawet gdy beta zamknięta. Decyzja architektoniczna (akceptowalna pre-GA).

---

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Integralność (P0)

1. **Naprawić cykl konfliktu 409** — `handleGraphConflict` (`IdeaMapWorkspace.tsx:451–461`) wywołuje toast bez refresh; `useIdeaMapSync.ts:264–268` podbija wersję bez rehydracji → silent overwrite. Naprawienie: realny `graphRuntime.refresh()` z serwera po 409, nie podbijanie wersji przed mergem. Weryfikacja: test integration `map-sync-conflict.test.ts` + screenshot po wymuszonym konflikcie.

2. **Migracja `my_idea_map_snapshots`** — endpointy snapshot zwracają wieczne 503 bo tabela nie istnieje w żadnej migracji (`my-work.routes.ts:4515, 4563, 4626`). Decyzja: czy kanon to `my_idea_map_snapshots` czy `my_idea_map_versions` (mig. 622, kod jej nie używa) — scalić lub usunąć martwą. Weryfikacja: `POST /:id/map/snapshots` → 201.

3. **Jeden runtime persystencji dla 4 narzędzi** — table/process_flow/whiteboard mają własne instancje `useIdeaMapSync` z niezależnymi licznikami wersji (`useTablePersistence.ts:111`, `IdeaProcessFlowTool.tsx:531`, `IdeaWhiteboardTool.tsx:645`) → samowywołane 409. Naprawienie: `externalRuntime` jak w mindmap (`IdeaMapWorkspace.tsx:2828–2840`). Weryfikacja: przełączenie między narzędziami bez 409 w network tab.

### Fala 2 — Domknięcie wartości (P1)

4. **Flush przy przełączeniu/odmontowaniu** — `useIdeaMapSync.ts:375–381` czyści timery bez flusha → utrata zmian <800 ms. Dodać flush synchroniczny lub `sendBeacon` w cleanup. Weryfikacja: edycja → szybkie przełączenie narzędzia → sprawdzić w DB.

5. **Testy serwerowe kontraktu map-sync** — zero BE testów dla ~45 endpointów. Minimum: integration tests dla `POST /sync` (baseVersion, 409, empty-reset guard), `POST /convert` (6 targetów), `GET /my-ideas` (scope filter). Weryfikacja: `npm run test:integration` PASS.

6. **Rozstrzygnąć `my_idea_map_versions`** — tabela istnieje (mig. 622), zero kodu jej używa; `my_idea_map_snapshots` ma kod bez tabeli — jedno z dwóch jest właściwym przeznaczeniem. Decyzja: wdrożyć wersjonowanie na jednej tabeli i usunąć martwą.

7. **`[INTEGRACJA — INTEGRACJE.md §C poz.3 / Sprint 7+ / DECYZJA #9]`** Eksport serwerowy Ideas → Outputs — `final-batch.routes.ts:32` → `finalBatchService.ts:19` tworzy wpis `idea_exports` ze statusem `pending`, ale plik nigdy nie powstaje (STUB). Albo zaimplementować worker generacji pliku (docelowo `v8_output_artifacts`), albo usunąć przycisk eksportu z UI — Weryfikacja: eksport tworzy plik do pobrania LUB przycisk niewidoczny.

### Fala 3 — Jakość i kanony (P2)

7. **Confirm przed aplikacją szablonu na niepusty graf** — `IdeaTemplateGallery.tsx:1886–1908` nadpisuje bez dialogu. Dodać modal potwierdzenia jeśli `nodes.length > 0`. Weryfikacja: próba aplikacji szablonu na istniejącą mapę → pojawia się dialog.

8. **Sprzątanie martwego kodu i logów** — wytnij `IdeaCanvasToolSelector.tsx` (158 linii, niemontowany); usuń 4× `console.log` z `IdeaMapWorkspace.tsx:433, 719, 1172, 1809`; usuń `canvasLocked=false` hardcode (`IdeaMapWorkspace.tsx:373`).

9. **Persystencja notatek w IdeaContextPanel** — `useState` bez DB (`IdeaContextPanel.tsx:141, 895–905`); dodać endpoint `PATCH /my-ideas/:id/context-notes` + kolumnę w `my_ideas`. Weryfikacja: wpisz notatkę → przeładuj → nadal widoczna.

10. **Wdrożyć realny eksport serwerowy lub usunąć rejestr** — `POST /v4-final/ideas/:id/export` tylko INSERT-uje request; plik nigdy nie powstaje. Decyzja: worker generujący plik lub usunięcie endpointu + wyczyszczenie telemetrii z `IdeaExportMenu.tsx:498–509`.

11. **E2E smoke do CI tier0** — `qa-idea-mindmap-checklist.spec.ts` jest w katalogu smoke (nightly) ale nie w tier0. Dodać do explicit tier0 list w `test-suite.yml`. Weryfikacja: `test-suite.yml` uruchamia spec na każdym PR.

### Definition of Done (odhaczane przy realizacji)

- [ ] 1. Testy auto FE+BE scenariuszy krytycznych S1–S5 zielone w CI (unit + integration)
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami (screenshoty S1–S5)
- [ ] 3. Railway: migracja `my_idea_map_snapshots` zastosowana, smoke endpointów 200, czyste logi
- [ ] 4. Kanony: §27 A–S bez odstępstw P0/P1 dla listy idei; konsola bez `console.log`
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE: conflict handler rehydruje, snapshoty działają, notatki trwałe
- [ ] 6. Zero cichych degradacji bez komunikatu: 503 snapshot → komunikat w UI; conflict → dialog merge lub wyraźne odrzucenie
