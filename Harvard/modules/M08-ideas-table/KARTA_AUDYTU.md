# M08 — Ideas — Table — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec59536`) · **Audytor:** Claude (subagent autonomiczny)
**Wejścia:** _MODULE_MAP_V2 wpis M08 · inwentarz `Harvard/podzial/ideas/MODULE_02D_table.md` · protokół `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md`
**Evidence:** `Harvard/modules/M08-ideas-table/evidence/` (Faza 4 niewykonana — brak przeglądarki)

## OCENA: 53/100 — Tier: Alpha · „NIEPEŁNY (bez Fazy 4)"
> **Re-audit 2026-06-11 po Sprintach 1–5:** A: 15→17 (W6 4 zepsute przyciski usunięte + generate_table dead case, commit `f35aa8d7c8`); C: 7→8 (W15 CI gate, commit `99bda16792`); F: 8→9 (W1 2 pomocnicze zapytania org-scope, commit `b9f2dee9d2`). **Fala 2 (pominięte w re-audycie 2026-06-11):** A: 17→18 (ActivityFeed 401 fix — Api.get() zamiast raw fetch, commit `606c9f2c0e`). Suma: 18+11+8+0+7+9+0=53.

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 18/25 | Rdzeń (persistence + AI + 25 typów kolumn + 7 widoków) REALNE; SnapshotManager+Import usunięte (W6); ActivityFeed 401 naprawione (Sprint5, `606c9f2c0e`); AuditTrail path OK (W6) ale nadal brak auth headers; fałszywy streaming P2 |
| B. Wiring i dane | 15 | 11/15 | Ścieżka produkcyjna map-sync solidna, migracje kompleksowe; connector/activity/audit/snapshot trafiają w nieistniejące mounty; 2 zapytania `my_idea_maps` bez `organization_id` w kontekście pomocniczym (nie w głównej ścieżce zapisu) |
| C. Testy automatyczne | 15 | 8/15 | 137 testów PASS + W15 CI gate Londyn (`99bda16792`); testy pokrywają głównie ścieżkę platformy, zero dla useTablePersistence/FormulaEngineV2/useTableRows |
| D. Żywa użyteczność | 15 | 0/15 | Faza 4 niewykonana — brak przeglądarki; hard cap zastosowany |
| E. Kanony/UI | 10 | 7/10 | i18n PL/EN kompletne dla canvasTools; IdeaTableTool nie jest tabelą listową (§27 nie dotyczy — to narzędzie canvas); EmptyStateInline / brak ModuleHub (narzędzie, nie hub) — właściwy wzorzec; beta-plate via MYWORK_IDEAS:'closed' |
| F. Bezpieczeństwo/dostęp | 10 | 9/10 | Trzy warstwy spójne: beta nav-lock + ProtectedRoute + verifyToken; org+user scope na wszystkich endpointach; W1 naprawił 2 pomocnicze zapytania bez org_id (`b9f2dee9d2`) |
| G. Środowiska (Railway) | 10 | 0/10 | Faza 3 niewykonana — brak dostępu do Railway; D=0, G=0 per instrukcję (deferred) |
| **Hard cap zastosowany?** | — | — | NIE: Faza 4 niewykonana → max 70; suma surowa 52 < 70; cap nie jest wiążący |

**Werdykt:** Rdzeń narzędzia Ideas Table (blob-persist w map-sync, 25 typów kolumn, 7 widoków, realne AI przez llmService, 137 testów PASS) jest solidny i unikalny — lepszy grounding AI (kontekst assessmentów firmy) niż Airtable. Zaufanie użytkownika psuje jednak 4 widoczne przyciski zawsze kończące się błędem (Import→404, ActivityFeed→401, AuditTrail→404, Snapshot→404), fałszywy streaming w Copilot oraz promowana komenda `generate_table` której serwer nigdy nie zwraca. Blokadą do tier Beta jest: podłączenie 137 testów do CI + naprawa/ukrycie zepsutych przycisków.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

**Moduł:** Ideas Table (`IdeaTableTool.tsx`, 3692 linii) — narzędzie canvas w `IdeaMapWorkspace.tsx:2877`, oddzielne od M20 Tabele Studio (table-platform). Trwałość: jeden blob JSON w `my_idea_maps.extensions_json` per idea, nie tp_tables.
**Beta gating:** `MYWORK_IDEAS: 'closed'` + `BETA_ADMINS_EXEMPT = false` → cały moduł Ideas (i Table jako narzędzie w nim) niedostępny dla WSZYSTKICH ról. Narzędzie Table widoczne tylko po wejściu do workspace konkretnego idea.

**Checklist pozycji inwentarza (z MODULE_02D_table.md):** 8 grup funkcjonalnych

| # | Funkcja/obszar | Status z analizy | Werdykt audytu | Dowód |
|---|---|---|---|---|
| 1 | Trwałość (map-sync, blob JSON, autosave) | REALNA | REALNE | `my-work.routes.ts:3677` + `useTablePersistence.ts:118-264` |
| 2 | AI — NL command bar (ai-table-action) | REALNA | REALNE (z luką) | `my-work.routes.ts:8755` → `ideaAISuggestionsService.ts:381` |
| 3 | AI — ai-fill, ai-suggestions, AICopilot | REALNA + mock-streaming | REALNE (degradacja) | `:8710, :8790`; `AICopilotMode.tsx:117-131` |
| 4 | 25 typów kolumn + 7 widoków legacy | REALNE | REALNE | `CellRenderer.tsx:489-515`; `IdeaTableTool.tsx:2683-2767` |
| 5 | Konektory / Import | ZEPSUTE (404) | ZEPSUTE | `useConnectors.ts:112` → `/workspaces/{id}/connectors` ≠ istniejący mount |
| 6 | ActivityFeed / AuditTrail / Snapshots | CZĘŚCIOWO NAPRAWIONE | CZĘŚCIOWO | ActivityFeed: **NAPRAWIONE** (`606c9f2c0e`, Api.get() z JWT); AuditTrail: path fix W6 ale raw fetch — nadal 401; SnapshotManager: USUNIĘTE (W6) |
| 7 | ExportToPresentation | REALNA | REALNE | `ExportToPresentation.tsx:237` → `Api.createPresentationDeck` → `/api/presentations/decks` (`Gateway.ts:877`) |
| 8 | CrossTableRelations | REALNA | REALNE | `CrossTableRelations.tsx:141-143` → `Api.getMyIdeaMap` |
| 9 | FormulaEngineV2 | REALNA | REALNE | `FormulaEngineV2.ts` — SUM/AVG/MIN/MAX/COUNT/IF/CONCAT/SCORE |
| 10 | Undo/redo, CSV, skróty klawiaturowe | REALNE | REALNE | `useUndoRedo.ts:11-25`; `csvUtils.ts`; `useTableKeyboard.ts` |
| 11 | Platform path (ścieżka B) | UKRYTA (flaga OFF) | UKRYTE — świadome | `FeatureFlags.ts:23` `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false` |
| 12 | generate_table komenda AI | MOCK | ZEPSUTE | `AITableAssistant.tsx:39-58` promuje; `ideaAISuggestionsService.ts:391-402` — 0 wystąpień w prompt serwera |
| 13 | Rename tabeli (tab strip) | MOCK | MOCK | `IdeaTableTool.tsx:791-797` — tylko React state, 0 API |
| 14 | saveStatusLabel platformy | HARDCODE | MOCK | `useTablePlatformIntegration.ts:518` — zawsze „Automatycznie zapisane" |
| 15 | between/in filtry | ZEPSUTE | ZEPSUTE | `tableTypes.ts:50-58` zadeklarowane; `useTableRows.ts:86-96` — default przepuszcza |
| 16 | Martwa gałąź LegacyViewRouter | MARTWA | MARTWE | `IdeaTableTool.tsx:2641-2682` — `usePlatform &&` nieosiągalne |

**Scenariusze krytyczne (5):**
1. **S1 (E2E persist):** Otwórz idea → tool Table → dodaj 3 wiersze z różnymi kolumnami → przeładuj stronę → sprawdź czy dane przetrwały
2. **S2 (AI command):** Wpisz komendę NL „Sort by priority descending" → potwierdź że tabela się posortowała bez błędu
3. **S3 (AI fill):** Kliknij ai-fill na kolumnie ai_generated → sprawdź czy LLM faktycznie wypełnił komórki (nie wszystkie `'—'`)
4. **S4 (broken buttons):** Kliknij Import, ActivityFeed, AuditTrail, Snapshot → sprawdź kody HTTP odpowiedzi
5. **S5 (export):** Kliknij Export to Presentation → sprawdź czy deck powstał

**Obowiązujące kanony:** §27 TABLE_AND_PREVIEW_CANON — N.D. (IdeaTableTool to narzędzie canvas, nie lista-tabela standardowa); CARD_CONTENT_FORMULA — N.D.; beta-gating via `betaAccess.ts` SSOT — TAK; wzorzec hubowy — N.D. (narzędzie wewnątrz hubu My Work, nie samodzielny moduł).

---

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE (zweryfikowane)

- **Trwałość map-sync:** `useTablePersistence.ts:118-159` — pełny payload (kolumny, widoki, sortowania, filtry, formatRules) w `extensions.table`; hydratacja z normalizacją `Api.getMyIdeaMap` (`:161-264`); autosave draft `(:290-293)`; `canvas/useIdeaMapSync.ts:264-267` obsługuje konflikt 409 z `baseVersion`. `server/src/routes/my-work.routes.ts:3677` — `SELECT ... FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ?`
- **AI table-action (LLM):** `my-work.routes.ts:8755` → `generateTableAction` → `ideaAISuggestionsService.ts:381-432` — real llmService + modelRouter tier BUDGET; sort/filter/group/add_column/add_rows/summarize działają
- **AI fill:** `my-work.routes.ts:8790` → `generateAIFill` (`ideaAISuggestionsService.ts:434-491`) — LLM STANDARD + kontekst assessmentów org
- **AI suggestions/copilot:** `my-work.routes.ts:8710` → `generateSuggestions` — 4 tryby (brainstorm/devil's advocate/expand/summarize)
- **25 typów kolumn:** `CellRenderer.tsx:489-515` — text/number/select/multiselect/status/date/checkbox/rating/person/url/progress/formula/ai_generated/file/relation/rollup/emoji/color/currency/phone/email/created_time/created_by/last_edited_time/last_edited_by
- **7 widoków legacy:** `IdeaTableTool.tsx:2683-2767` — timeline/sticky/kanban/calendar/grid/gallery/matrix (matrix z wyborem osi); zapisane widoki per-layout
- **ExportToPresentation → real deck:** `ExportToPresentation.tsx:237` → `Api.createPresentationDeck` → `POST /api/presentations/decks` (`presentations.routes.ts:1285`, mountowany `Gateway.ts:877`)
- **CrossTableRelations:** `CrossTableRelations.tsx:141-143` → `Api.getMyIdeaMap` (by `org+user`-scoped endpoint)
- **FormulaEngineV2:** `FormulaEngineV2.ts` — SUM/AVG/MIN/MAX/COUNT po krawędziach grafu `children.`/`related.`, IF/CONCAT/SCORE, arytmetyka
- **Undo/redo 50 kroków:** `useUndoRedo.ts:11-25`; Tab/Enter/Arrows/Ctrl+Z `useTableKeyboard.ts`; CSV import/export `csvUtils.ts`; clipboard
- **applyProposal REALNE:** `TableAiEditorService.ts:336-430` — `executeProposalOperations` wykonuje realne mutacje (nie stub)
- **AICategorizeTool, IdeaScoringModel, VoiceImageInput, TableSummaryDashboard** — wszystkie na realnych endpointach
- **Eksport CSV:** `my-work.routes.ts:8828` → `SELECT nodes_json, extensions_json FROM my_idea_maps WHERE idea_id = ? AND user_id = ? AND organization_id = ?`

### 1b. MOCK / STUB / fabrykowane klientem

- **Fałszywy streaming Copilot:** `AICopilotMode.tsx:117-131` `simulateStreaming()` — odpowiedź przychodzi całość, potem „wypisywana" setIntervalem; użytkownik widzi streaming, który nie istnieje
- **Cichy fallback ai-fill:** błąd LLM → wszystkie komórki = `'—'` bez komunikatu (`ideaAISuggestionsService.ts:488-490`)
- **Cichy fallback kategoryzacji:** nieparsowalny JSON → lokalne klastrowanie po pierwszym słowie labela z confidence 0.5 udającym AI (`AICategorizeTool.tsx:94-118`)
- **Rename tabeli (tab strip):** `IdeaTableTool.tsx:791-797` — zmiana tylko w React state, zero API → znika po przeładowaniu
- **saveStatusLabel platformy:** `useTablePlatformIntegration.ts:518` — hardcode „Automatycznie zapisane" niezależnie od stanu zapisu
- **FrameworkGenerator szablony:** `FrameworkGenerator.tsx:39` — hardcodowane definicje SWOT itp.; UI sugeruje „generator"

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE

- **Konektory/Import — 404 zawsze:** `useConnectors.ts:112` → `GET /api/workspaces/{id}/connectors`; serwer nie ma mountu `/api/workspaces` dla connector CRUD (connector CRUD jest pod `/api/table-platform/connectors`, `Gateway.ts:953`); przycisk Import widoczny w `TableToolbar.tsx:1058-1065` → zawsze błąd 404
- **ActivityFeed — 401 zawsze:** `ActivityFeed.tsx:148-150` — surowy `fetch('/api/table-platform/tables/${tableId}/audit')` **bez Authorization header**; trasa wymaga `verifyToken` (`table-platform.routes.ts:306`); dodatkowo `tableId=ideaId` (id mapy, nie tp_tables id); przycisk widoczny `IdeaTableTool.tsx:1828,3332`
- **AuditTrailPanel — 404 zawsze:** `AuditTrailPanel.tsx:177` — `fetch('/api/tables/${id}/audit')`; mount `/api/tables` nie istnieje; przycisk widoczny
- **SnapshotManager — 404 zawsze:** `SnapshotManager.tsx:117,136,157` — `fetch('/api/bases/${baseId}/snapshots')`; mount `/api/bases` nie istnieje; przycisk widoczny `IdeaTableTool.tsx:1837`
- **generate_table w przykładach AI — nigdy nie zwracane:** `AITableAssistant.tsx:39-58` promuje „Stwórz tabelę oceny ryzyka…"; frontend obsługuje `case 'generate_table'` (`AITableAssistant.tsx:210-246`); prompt serwera w `generateTableAction` NIE zawiera `generate_table` w liście typów (`ideaAISuggestionsService.ts:391-402`) — LLM nigdy nie wygeneruje tej akcji
- **JSON.parse(content) wprost:** `ideaAISuggestionsService.ts:425` — jeśli LLM otoczy JSON w ```json fences (typowe), cichy error → odpowiedź type: 'error'
- **between/in filtry:** `tableTypes.ts:50-58` zadeklarowane; `useTableRows.ts:86-96` — 6 operatorów, domyślny case przepuszcza → filtry `between`/`in` nie filtrują

### 1d. UKRYTE / MARTWY KOD

- **Ścieżka platformy (B):** cały `useTablePlatformBridge`, P15ViewRouter, ChatToSchemaPanel, FormBuilder, AutomationsManager/SyncManager/SharingManager/DistributionManager, TableTabStrip (multi-tabele), StatusBar, realtime socket (`tableId: platformActive ? ideaId : null`) — ukryte za `ENABLE_TABLE_PLATFORM_METADATA_FIRST: false`; kod żywy, niemontowany → zostaw świadomie (droga do migracji)
- **Martwa gałąź LegacyViewRouter:** `IdeaTableTool.tsx:2641-2682` — `usePlatform && (kanban|calendar|grid)` nieosiągalne (wcześniejszy `switch` :2635 konsumuje te przypadki) → **wytnij**
- **PublicFormView.tsx, RecordTemplateManager.tsx, useAttachments.ts, useAuditTrail.ts** — zero konsumentów w runtime → **wytnij**
- **Katalog `offline/`** — kod ServiceWorker/offline dla tabeli; niezarejestrowany w app → **wytnij**
- **GalleryView, GanttView, FormView** w `table/views/` — LegacyViewRouter martwy → **wytnij**

### 1e. Wiring FE↔BE↔DB

| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Odczyt mapy (hydratacja) | `GET /api/my-work/my-ideas/:id/map` | `my_idea_maps` | `20260312_my_idea_maps.sql` | REALNE |
| Zapis mapy (map-sync) | `POST /api/my-work/my-ideas/:id/map/sync` | `my_idea_maps.extensions_json` | `20260313_my_idea_maps_graph_contract_v3.sql` | REALNE |
| AI table-action (NL→op) | `POST /api/my-work/my-ideas/:id/ai-table-action` | — (LLM only) | — | REALNE |
| AI fill | `POST /api/my-work/my-ideas/:id/ai-fill` | — (LLM + org context) | — | REALNE |
| AI suggestions/copilot | `POST /api/my-work/my-ideas/:id/ai-suggestions` | — | — | REALNE |
| Eksport CSV | `GET /api/my-work/my-ideas/:id/export-csv` | `my_idea_maps` | jak wyżej | REALNE |
| Export to Presentation | `POST /api/presentations/decks` | `presentation_decks` | `presentations` migrations | REALNE |
| Konektory | `GET /api/workspaces/:id/connectors` | tp_connectors | 700+ migrations | ZEPSUTE (404 — błędny mount) |
| ActivityFeed | `GET /api/table-platform/tables/:id/audit` | tp_audit_log | 700+ migrations | ZEPSUTE (401 — brak auth header) |
| AuditTrail | `GET /api/tables/:id/audit` | — | — | ZEPSUTE (404 — mount nie istnieje) |
| Snapshots | `GET/POST /api/bases/:id/snapshots` | — | — | ZEPSUTE (404 — mount nie istnieje) |

### 1f. Flagi

| Flaga | Default BE (runtime) | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|
| `ENABLE_TABLE_PLATFORM_METADATA_FIRST` | `false` (`FeatureFlags.ts:23`) | `false` (`useFeatureFlags.tsx:138-145`) | per-org przez `feature_flags` DB → `/api/feature-flags/runtime` | Cała ścieżka platformy (B) aktywna lub nie; multi-tabele, FormBuilder, realtime, ChatToSchemaPanel |
| `ENABLE_TABLE_PLATFORM_RECORDS_API` | `true` (`FeatureFlags.ts:24`) | — | env var | Endpointy `/api/table-platform/*` żyją (ale narzędzie nie używa bez metadataFirst) |
| `MYWORK_IDEAS: 'closed'` | — | `betaAccess.ts:58` | właściciel przez `betaAccess.ts` | Blokuje cały tab Ideas (i narzędzie Table w nim) dla WSZYSTKICH ról |
| `BETA_ADMINS_EXEMPT` | — | `false` (`betaAccess.ts:32`) | właściciel | Admini nie są wyłączeni z beta-lock |

### 1g. Połączenia międzymodułowe

| Kierunek | Moduł po drugiej stronie | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M05 Ideas Zarządzanie | parametr `ideaId` → `IdeaMapWorkspace.tsx:2877` | `IdeaMapWorkspace.tsx:2877-2892` | DZIAŁA |
| WEJŚCIE ← | M01 Czat (Teresa) | `onTableContextChange` → context do czatu | `IdeaMapWorkspace.tsx:2891` | DZIAŁA |
| WYJŚCIE → | M19 Prezentacje | `Api.createPresentationDeck` → `POST /api/presentations/decks` | `ExportToPresentation.tsx:237` | DZIAŁA |
| WYJŚCIE → | M05 Ideas (inne) | `Api.getMyIdeaMap` → cross-idea relation | `CrossTableRelations.tsx:141-143` | DZIAŁA |
| WYJŚCIE → | M05/M03 (zadania) | `handleConvert('task_set')` → tworzenie zadań z wierszy | `IdeaMapWorkspace.tsx:2886` | DZIAŁA |
| WEJŚCIE ← | M20 Tabele Studio (platforma) | `useTablePlatformBridge` — ścieżka B | `IdeaTableTool.tsx:301-562` | UKRYTE (flaga OFF) |
| WYJŚCIE → | M20 socket `/table-platform` | realtime WebSocket | `IdeaTableTool.tsx:275` | UKRYTE (platformActive=false) |

---

## 2. Testy automatyczne (FAZA 2)

**Uruchomienie:** `npx vitest run src/components/MyWork/table` @ `f8fec59536` → **PASS 137 / FAIL 0 / SKIP 0** (czas: 3.29 s)

| Plik testu | Zakres | Liczba | Wynik | W CI? |
|---|---|---|---|---|
| `table/__tests__/TablePlatformFrontend.test.tsx` | Bridge, mappery, P15, breadcrumby, ActivityFeed path, degraded scenarios | 37 | PASS | NIE |
| `table/__tests__/PlatformCellRenderer.specialized.test.tsx` | Specjalistyczne renderery komórek platformy | ~10 | PASS | NIE |
| `table/cells/__tests__/PriorityCell.test.tsx` | Komórka priorytetu | ~5 | PASS | NIE |
| `table/cells/__tests__/RiskScoreCell.test.tsx` | Komórka ryzyko | ~5 | PASS | NIE |
| `table/cells/__tests__/AiClassificationCell.test.tsx` | Komórka klasyfikacja AI | ~5 | PASS | NIE |
| `table/cells/__tests__/AiSummaryCell.test.tsx` | Komórka podsumowanie AI | ~5 | PASS | NIE |
| `table/cells/__tests__/SourceReferenceCell.test.tsx` | Komórka źródło | ~5 | PASS | NIE |
| `table/provenance/__tests__/` (5 plików) | Proweniencja: wskaźniki, badge, źródła, dialog | ~50 | PASS | NIE |
| `table/forms/__tests__/IntakeJwtPanel.test.tsx` | Formularz intake JWT | ~5 | PASS | NIE |
| `table/forms/__tests__/PublicJwtFormPage.test.tsx` | Publiczna strona formularza | ~5 | PASS | NIE |

**CI:** `.github/workflows/test-suite.yml` uruchamia TYLKO `tests/unit` i `tests/integration` (linia 314 i 509) — **żaden z 137 testów nie jest w CI**.

**Pokrycie scenariuszy krytycznych:**

| Scenariusz | FE | BE | E2E | CI | Luka |
|---|---|---|---|---|---|
| S1: persist + reload | NIE | NIE | NIE | NIE | Brak testu useTablePersistence i map-sync roundtrip |
| S2: AI NL sort | NIE | NIE | NIE | NIE | Brak testu generateTableAction e2e |
| S3: AI fill | NIE | NIE | NIE | NIE | Brak testu generateAIFill (ciche `'—'` fallback) |
| S4: broken buttons | NIE | NIE | NIE | NIE | ActivityFeed auth test ≠ test zachowania (nie weryfikuje braku auth) |
| S5: export deck | NIE | NIE | NIE | NIE | Brak testu ExportToPresentation → `/presentations/decks` |

**Backlog testowy:**
1. [P0] unit — `useTablePersistence.ts` — S1: persist payload + reload hydration
2. [P0] unit — `ideaAISuggestionsService.ts` — S3: generateAIFill ciche `'—'` fallback + fenced JSON w generateTableAction
3. [P1] integration — `my-work.routes.ts` (ai-table-action) — S2: NL→operacja roundtrip
4. [P1] unit — `ActivityFeed.tsx` — S4: brak Authorization header → 401; nie tylko URL
5. [P1] unit — `useTableRows.ts` — operatory between/in przepuszczają (zawsze PASS)
6. [P2] unit — `FormulaEngineV2.ts` — testy regresji dla SUM/AVG po krawędziach i IF/CONCAT

---

## 3. Środowiska / Railway (FAZA 3)

| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | brak dostępu Railway | brak dostępu Railway | BRAK DANYCH |
| Migracje modułu zastosowane | `20260220_my_work_my_ideas.sql`, `20260312_my_idea_maps.sql`, `20260313_...`, `622_my_idea_map_versions.sql`, `633_v4_idea_canonical_schema.sql`, `20260308_my_ideas_ai_incubator.sql`, `20260602_my_ideas_folders_favorites_recents.sql` | brak weryfikacji | NIEZWERYFIKOWANE (migracje istnieją w repo) |
| Flagi/env wymagane | `ENABLE_TABLE_PLATFORM_METADATA_FIRST=false` (default), `ENABLE_TABLE_PLATFORM_RECORDS_API=true` (default) | jak staging | DEFAULTY — brak dodatkowych wymagań |
| Smoke endpointów | brak dostępu | brak dostępu | NIEWYKONANE |
| Błędy w logach | brak dostępu | brak dostępu | NIEWYKONANE |

**Uwaga:** Dev backend uderza w PROD DB (`finding_assistant_prompt_sot.md`) — audyt statyczny nie wymaga smoke live.

---

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)

**Środowisko:** NIEWYKONANE — brak przeglądarki/preview w tej sesji
**Status:** NIEPEŁNY (bez Fazy 4) → hard cap max 70/100

| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1 | Persist + reload tabeli | BLOCKED (brak przeglądarki) | — |
| S2 | AI NL sort | BLOCKED | — |
| S3 | AI fill | BLOCKED | — |
| S4 | Broken buttons (404/401) | BLOCKED | — |
| S5 | Export to Presentation | BLOCKED | — |

**Przyciski-zawsze-błąd znalezione (statycznie):** Import/Konektory (404), ActivityFeed (401), AuditTrail (404), SnapshotManager (404) — 4 widoczne w prod

---

## 5. Kanony i standardy (FAZA 5)

**§27 TABLE_AND_PREVIEW_CANON:**
`IdeaTableTool.tsx` to narzędzie canvas (w workspace idea), nie standardowa tabela listowa modułu — `§27` dotyczy list-tabel w modułach (jak Ideas Management lista, Tasks, Decisions). Narzędzie Table ma własny system nagłówków, sortowania, wierszy — nie korzysta z ResizableTable/PreviewPanel/Menu3. **§27 N.D. dla tego komponentu.**

**CARD_CONTENT_FORMULA:** N.D. — moduł nie produkuje kart Insight/Initiative.

**Wzorzec hubowy (ModuleHub/MELS):** N.D. — IdeaTableTool jest narzędziem canvas wewnątrz `IdeaMapWorkspace`, nie samodzielnym modułem z hub layoutem.

**i18n PL/EN:**
- `canvasTools.table`/`canvasTools.tableTooltip`: PL ✓ (`pl/translation.json:1132-1133`) + EN ✓ (`en/translation.json:1875-1876`)
- IdeaTableTool sam korzysta z `isPl` flagi (`i18n.language?.startsWith('pl')`, `:228`) + hardcoded PL/EN stringi wewnątrz (nie klucze i18n) — wzorzec konsekwentny w całym module Ideas, ale nie w pełni i18n-compliant
- AI promptów i przykładowych komend: bilingual (EXAMPLE_COMMANDS PL/EN `AITableAssistant.tsx:39-58`)

**Beta gating:** `MYWORK_IDEAS: 'closed'` w `betaAccess.ts:58` — SSOT, poprawny. `MyWorkHub.tsx:607` — sprawdza i blokuje. Beta-plate zgodna.

**Stany standardowe:**
- Empty (brak danych): `EmptyStateInline` (`IdeaTableTool.tsx:2518`) ✓
- Error state: `effectiveLoadError` → `EmptyStateInline` z Retry (:2516-2530) ✓
- Loading: szkielet podczas ładowania (TablePlatformFrontend.test.tsx confirms `renders loading skeleton`) ✓

**Odstępstwa:**
- [P2] IdeaTableTool używa `isPl` + wewnętrznych PL/EN stringów zamiast kluczy i18n — nie łamie funkcjonalności, ale trudniejsza lokalizacja
- [P2] `saveStatusLabel` zawsze „Automatycznie zapisane" — mysząd użytkownika

---

## 6. Bezpieczeństwo i dostęp (FAZA 6)

**Trzy warstwy gatingu:**

| Warstwa | Mechanizm | Szczegół | Dziura? |
|---|---|---|---|
| Nawigacja | `MyWorkHub.tsx:607` — `isBetaSubareaClosed + isBetaLockedForRole` | Blokuje tab Ideas dla wszystkich | NIE — spójne |
| Route | `MyWorkHub` + lazy import `IdeaMapWorkspace` | Narzędzie Table widoczne tylko w kontekście idea workspace | NIE |
| API | `router.use(verifyToken)` (`my-work.routes.ts:74`) — cały router za auth | Każde wywołanie wymaga ważnego JWT | NIE |

**Org-scope na endpointach modułu:**
- `my_ideas` CRUD: `WHERE id = ? AND user_id = ? AND organization_id = ?` — WSZĘDZIE ✓
- `my_idea_maps` główna ścieżka: `WHERE idea_id = ? AND user_id = ? AND organization_id = ?` — `my-work.routes.ts:3461, 3677, 5038, 5492, 5595` ✓
- `my_idea_maps` 2 zapytania pomocnicze bez org_id: `my-work.routes.ts:6022, 6097` — `WHERE idea_id = ? AND user_id = ?` (brak `AND organization_id = ?`); kontekst: w handlerze `POST /my-ideas/:id/develop` — `id` zweryfikowane z `user_id + organization_id` wcześniej (:6589-6593); ryzyko minimalne (id + user_id = wystarczający scope), ale formalnie brakujące `AND organization_id = ?`
- AI endpoints (`ai-table-action`, `ai-fill`, `ai-suggestions`): `requireUser` → `userId + orgId` przekazane do service, ale brak sprawdzenia własności `ideaId` przed wywołaniem LLM — można wywołać AI na `ideaId` innego użytkownika jeśli zna UUID; LLM zwraca operacje (nie odczytuje danych tabeli), service używa `orgId` do modelu AI: **P2** (nie eksponuje danych, ale pozwala na wywołanie AI na obcy id)
- Export CSV: `WHERE idea_id = ? AND user_id = ? AND organization_id = ?` ✓

**Zasoby publiczne:** brak publicznych share tokenów dla narzędzia Table (PublicFormView martwy)
**WS/realtime:** `tableId: platformActive ? ideaId : null` — socket nieaktywny przy `platformActive=false`; przy włączonej ścieżce B: autoryzacja przez JWT przy upgrade (RealtimeService.ts)
**Capabilities serwerowo:** brak capability gate na AI endpoints (weryfikacja auth/org wystarczająca dla scope; capabilities nie są wymagane dla Ideas modules)

**Findingi:**
- [P2] `my-work.routes.ts:6022,6097` — 2 zapytania `my_idea_maps` bez `organization_id`; kontekst: id zweryfikowane wcześniej w tym samym handlerze (`develop`), ryzyko praktycznie zerowe
- [P2] `ai-table-action`/`ai-fill`/`ai-suggestions` — brak sprawdzenia własności `ideaId` przed wywołaniem LLM; użytkownik może wywołać AI na UUID obcej idei; serwis nie zwraca danych tej idei, tylko generuje operacje; ryzyko: koszt LLM na cudzym id
- [P3] `ActivityFeed.tsx:148-150` — `fetch` bez Authorization header; to zepsuta funkcja (widoczna w UI), nie luka bezpieczeństwa jako taka

---

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Integralność (P0)

1. **Napraw lub ukryj 4 zawsze-błąd przyciski** — Import/Konektory (404: mount `workspaces` nie istnieje), ActivityFeed (401: brak auth header + błędny tableId), AuditTrailPanel (404: mount `api/tables` nie istnieje), SnapshotManager (404: mount `api/bases` nie istnieje); 4 przyciski widoczne w prod zawsze kończą się błędem → ukryj za `usePlatform` flag albo napraw mount; Weryfikacja: kliknij każdy przycisk → brak błędów 4xx w network tab

2. **Napraw fenced JSON w generateTableAction** — `ideaAISuggestionsService.ts:425` `JSON.parse(content)` wprost; LLM często odpowiada w ````json ... ```` → cichy error zamiast akcji; strip fences przed parse; Weryfikacja: unit test z odpowiedzią `````json{"type":"sort",...}````` → akcja zwrócona

3. **Dodaj `organization_id` do 2 pomocniczych zapytań `my_idea_maps`** — `my-work.routes.ts:6022,6097` brakuje `AND organization_id = ?`; Weryfikacja: grep `my_idea_maps WHERE` → zero wyników bez `organization_id`

### Fala 2 — Domknięcie wartości (P1)

4. **Napraw generate_table end-to-end** — `AITableAssistant.tsx:39-58` promuje tę komendę w przykładach; `ideaAISuggestionsService.ts:391-402` nie zawiera `generate_table` w liście typów akcji → LLM nigdy nie wygeneruje; dodaj typ do promptu + parsowanie propozycji; Weryfikacja: komenda „Stwórz tabelę…" → propozycja tabeli widoczna w UI

5. **Napraw ActivityFeed — dodaj Authorization header** — `ActivityFeed.tsx:148-150` surowy `fetch` bez auth; przenieść na `Api.get` lub dodać `getHeaders()`; Weryfikacja: sieć → 200 zamiast 401

6. **Sprawdź ai-table-action ownership** — brak weryfikacji `ideaId` należy do `userId+orgId` przed wywołaniem LLM; dodaj `requireTables + SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?` na początku handlera; Weryfikacja: integration test z obcym ideaId → 404

7. **Podłącz 137 testów do CI** — `.github/workflows/test-suite.yml` uruchamia tylko `tests/unit`+`tests/integration`; dodaj job lub rozszerz `vitest run src/components/MyWork/table`; Weryfikacja: CI zielone na PR

8. **Usuń ciche degradacje AI bez komunikatu** — `ideaAISuggestionsService.ts:488-490` → `'—'` bez toastu; `AICategorizeTool.tsx:94-118` → fake AI; dodaj toast/error UI; Weryfikacja: odcięcie sieci → komunikat błędu widoczny

### Fala 3 — Jakość i kanony (P2/P3)

9. **Sprzątnij martwy kod** — `IdeaTableTool.tsx:2641-2682` (nieosiągalna gałąź LegacyViewRouter), `PublicFormView.tsx`, `RecordTemplateManager.tsx`, `useAttachments.ts`, `useAuditTrail.ts`, katalog `offline/`, `GalleryView/GanttView/FormView` w `table/views/` — Weryfikacja: grep importów → zero

10. **Napraw between/in filtry** — `tableTypes.ts:50-58` zadeklarowane, `useTableRows.ts:86-96` default przepuszcza → dodaj implementację operatorów; Weryfikacja: unit test filtr `between 3 and 7` → tylko wiersze spełniające warunek

11. **Testy dla ścieżki produkcyjnej** — backlog pkt 1-4 (useTablePersistence, generateAIFill fallback, ActivityFeed auth, generateTableAction JSON parse); Weryfikacja: pokrycie scenariuszy S1-S5

12. **Rename tabeli → API** — `IdeaTableTool.tsx:791-797` tylko React state; dodaj PATCH na ideę lub na map extensions; Weryfikacja: rename → reload → nazwa zachowana

13. **Decyzja strategiczna dual-stack** — ~40% kodu narzędzia (ścieżka B) martwe za flagą OFF; każdy tydzień dual-stacku = podwójne utrzymanie; zdecydować: dokończyć migrację metadata-first lub wyciąć ścieżkę B

---

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (S1-S5) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami (screenshoty + console/network czyste)
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (4 przyciski: naprawione lub ukryte)
- [ ] 6. Zero cichych degradacji bez komunikatu (ai-fill fallback, kategoryzacja, generate_table)
