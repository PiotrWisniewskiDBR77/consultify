# M04 — Notatnik (Notebook) · FAZA 2: Testy

Data: 2026-06-11 · Branch: feat/deliverables-light · Agent: TESTY
Log surowy: `Harvard/modules/M04-notatnik/evidence/f2_tests.log`

---

## 1. Inwentarz testów

### Blok A — FE komponenty + unit (root vitest, env jsdom)

| Plik | Czego dotyczy | Testy |
|---|---|---|
| `tests/components/MyWork/NotebookLibraryContent.test.tsx` | Biblioteka L1: lista notatników, create/update/delete (mock `@/services/api`) | 4 |
| `tests/components/MyWork/notebookMetadataBadges.test.tsx` | Render badge'y metadanych (PL/EN, pusty stan) | 4 |
| `tests/components/MyWork/NotebookCanonicalPathStrip.test.tsx` | Pasek ścieżki kanonicznej + callbacki (attachments/AI proposal/convert) | 1 |
| `tests/components/MyWork/NotebookContent.manual-gate.test.tsx` | Strona notatnika: bramka ręczna, ładowanie stron/proposali (mock api + Router) | 3 |
| `tests/components/MyWork/ConvertToOutputMenu.notebook-readback.test.tsx` | Konwersja → output + readback do notatnika (wszystko mock) | 1 |
| `tests/components/MyWork/NotebookContextPanel.outputs.test.tsx` | Panel kontekstu: linkowane outputy z backlinków inicjatyw (mock hooki) | 3 |
| `src/components/MyWork/__tests__/NotebookLibraryContent.smoke.test.tsx` | Smoke biblioteki (mock api) | 4 |
| `tests/unit/mywork/notebookExpandToDocument.test.ts` | Czyste fn: content→markdown, draft body, expand→Canvas (fetch stub) | 5 |
| `tests/unit/components/MyWork/notebookCaptureSourceSummary.test.ts` | Czysta fn: podsumowanie źródła capture | 5 |
| `tests/unit/components/MyWork/notebookConvertedOutputSummary.test.ts` | Czysta fn: podsumowanie skonwertowanego outputu | 2 |
| `tests/unit/services/api-my-work-notebook-fallback.test.ts` | Klient API: fallback'i kolumn/tabel (mock fetch, brak serwera) | 22 |

### Blok B — backend unit + integration (root vitest, env node)

| Plik | Czego dotyczy | Testy |
|---|---|---|
| `tests/unit/backend/v4-smoke/r1-notebook.test.ts` | Smoke serwisu (queryHelpers + Logger mock) | 7 |
| `tests/unit/backend/services/notebookService.test.ts` | NotebookService: capture/index (mock Database + embedding) | 3 |
| `tests/unit/backend/services/notebookContainerService.test.ts` | Kontenery notatników CRUD (mock queryHelpers) | 16 |
| `tests/integration/p07-notebook-runtime-gaps.test.ts` | Kanon P07 runtime-gaps: entry points, provenance, attachments, search, **handoff payloads**, anti-dup, degraded (mock DB/embedding/fs) | 64 (`.each`) |
| `tests/integration/p07-notebook-canon.contract.test.ts` | Kanon P07 kontrakt: struktura, handoff, search hints, taksonomia błędów | 20 |

### Blok C — server/src (server vitest config, cwd=server/)

| Plik | Czego dotyczy | Testy |
|---|---|---|
| `server/src/routes/__tests__/my-work-notebook.routes.test.ts` | Trasa legacy (mock dbSchema/queryHelpers/auth/demoGuard/rateLimit) | 1 |
| `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts` | Trasy v8: pages/capture/AI proposal/convert/attachments — **wszystkie serwisy mockowane** | 16 |
| `server/src/routes/v8/__tests__/p07-notebook-canon.test.ts` | Kanon §2.3 + integracja capture (mock queryHelpers/DB/embedding/sourceFile) | 55 |
| `server/src/services/__tests__/notebookAttachmentService.test.ts` | Załączniki: persist/resolve/delete (mock queryHelpers/uuid/fs) | 3 |
| `server/src/services/__tests__/notebookService.contract.test.ts` | Kontrakt buildSnapshot + klasa NotebookService — **8 `it.todo`** (capture/listPages/getPage/updatePage/deletePage/addAttachment/removeAttachment) | 3 (+8 todo) |
| `server/src/services/__tests__/notebookContainerService.smoke.test.ts` | Smoke kontenerów (mock middleware + queryHelpers) | 11 |

> Pominięte: snapshoty w `.drive-sync-backup/**` (kopie, nie uruchamiane).

---

## 2. Wynik uruchomienia

| Blok | Pliki | PASS | FAIL | SKIP/TODO | Czas |
|---|---|---|---|---|---|
| A — FE komponenty + unit | 11 | 54 | 0 | 0 | 1.93 s |
| B — backend unit + integration | 5 | 110 | 0 | 0 | 0.85 s |
| C — server/src | 6 | 89 | 0 | 8 todo | 0.93 s |
| **RAZEM** | **22** | **253** | **0** | **8 todo** | **~3.7 s** |

**FAIL = 0.** Brak mock-drift, brak stale-import, brak brakującego Routera, brak błędów schema-drift PG — bo żaden test nie dotyka realnej DB (wszystkie mockują warstwę zapytań). Brak błędów roli iris.

Uwaga niekrytyczna: `NotebookContextPanel.outputs.test.tsx` loguje React warning „two children with the same key `backlink-1`" — test przechodzi, ale wskazuje realny bug deduplikacji kluczy w renderze linkowanych outputów.

---

## 3. Mapa pokrycia S1–S8

| Scenariusz | FE | BE | E2E | PR-gate (Londyn) | Ocena |
|---|---|---|---|---|---|
| **S1** Biblioteka L1 (filtry/liczniki) | ✅ Library + smoke (4+4) | ✅ container CRUD (16+11) | ❌ | ❌ | Solidne na poziomie listy; **filtry/liczniki testowane płytko** (render, nie logika filtrowania) |
| **S2** CRUD notatnika (rename/archive/delete) → trwałość | ✅ create/update/delete (mock api) | ✅ container service mock | ❌ | ❌ | **Trwałość = 0** (wszystko mock, brak DB roundtrip) |
| **S3** Strona + edytor TipTap → autosave/trwałość | ⚠️ tylko manual-gate render | ✅ updatePage = `it.todo` | ❌ | ❌ | **LUKA KRYTYCZNA** — brak testów edytora/autosave; `extensions.ts`, `NotebookContent` autosave nietknięte |
| **S4** SlashMenu bloki + AI | ❌ brak | ❌ brak | ❌ | ❌ | **ZERO** — `SlashMenu.tsx`, `InsertMenu.tsx`, `AICommandPrompt.tsx` bez testów |
| **S5** Ekstrakcja akcji AI | ⚠️ canonical-path callback stub | ⚠️ createAIProposal = mock; impl = czysty INSERT (brak LLM!) | ❌ | ❌ | **FAŁSZYWA ZIELEŃ** — „AI" to zapis proposala dostarczonego przez klienta; brak realnej ekstrakcji |
| **S6** Konwersje (→output/→zadania/→Canvas) | ✅ ConvertToOutput readback; expand→Canvas fn (5) | ⚠️ handoff = walidacja payloadu; convertNotebookPage mock | ❌ | ❌ | Kontrakt payloadu OK; **realny handoff nieweryfikowany** |
| **S7** Załączniki upload/download | ⚠️ path-strip callback | ✅ attachmentService persist/resolve/delete (fs mock) | ❌ | ❌ | Średnie; fs i DB mock — brak realnego upload/download |
| **S8** Capture API | — | ✅ capture w canon + v8 routes + r1-smoke (mock DB) | ❌ | ❌ | Kontrakt/walidacja OK; **brak realnego ingestu** (extractText/embedding mock) |

PR-gate: `test-suite.yml` wyzwala się tylko na `push`/`pull_request` do `main`/`develop`. **Default branch = Londyn → żaden PR do Londyn nie odpala tej bramki.** Nightly/weekly e2e (`e2e-nightly.yml`, `e2e-weekly.yml`) nie zawierają speców notebook (grep = 0 trafień w `tests/e2e`). **Notatnik nie ma żadnego e2e i nie jest chroniony bramką PR na obecnym branchu.**

---

## 4. Pułapki / fałszywa zieleń

1. **AI „ekstrakcja akcji" (S5) nie jest AI.** `notebookService.createAIProposal()` to wyłącznie `INSERT` do `notebook_ai_proposals` z treścią dostarczoną przez wywołującego — brak jakiegokolwiek wywołania LLM w ścieżce notatnika. Testy route'ów dodatkowo mockują całą funkcję. Zielony test sugeruje działającą ekstrakcję, której w kodzie nie ma.
2. **Persistencja w 100% zamockowana.** Każdy test BE stubuje `queryHelpers`/`Database`. Żaden roundtrip do PG/SQLite. Schema-drift (np. brak kolumny `np.capture_source`) NIE zostałby wykryty — testy wręcz asercjonują fallback-SQL, a nie zachowanie realnej bazy. 8 `it.todo` w `notebookService.contract.test.ts` to jawnie nienapisane testy trwałości (capture/updatePage/deletePage/attachments).
3. **Konwersje (S6) to kontrakt payloadu, nie handoff.** `convertNotebookPage` mockowane w route-teście; integracja sprawdza tylko obecność pól w payloadzie handoff (Radar/Inicjatywy/Teresa). Realny zapis do `tool_sessions`/inicjatyw/zadań nieweryfikowany end-to-end.
4. **Edytor TipTap + autosave (S3) i SlashMenu (S4) — kompletny brak testów.** Istnieją realne komponenty (`extensions.ts`, `SlashMenu.tsx`, `AICommandPrompt.tsx`, `InsertMenu.tsx`, `NotebookToolbar.tsx`, `AITopicsPanel.tsx`) bez ani jednego testu. To rdzeń edycji notatki — najbardziej narażony na regresję, zupełnie niechroniony.
5. **Klient API testowany bez serwera** (`api-my-work-notebook-fallback.test.ts`, 22 testy) — `fetch` mock; zielony stan nie dowodzi że backend odpowiada poprawnie (to test logiki fallbacku klienta, nie integracji).
6. **Bug ujawniony, nie złapany asercją:** duplikat klucza React `backlink-1` w `NotebookContextPanel` (warning w logu, test zielony).

---

## 5. Backlog testowy

| # | Typ | Plik (proponowany) | Scenariusz | Priorytet |
|---|---|---|---|---|
| B1 | Component (FE) | `tests/components/MyWork/notebook/SlashMenu.test.tsx` | SlashMenu: otwarcie, filtrowanie pozycji, wstawienie bloku (heading/list/divider), wybór akcji AI → wywołanie callbacku | **P0** |
| B2 | Component (FE) | `tests/components/MyWork/notebook/NotebookEditor.autosave.test.tsx` | TipTap: edycja treści → debounce autosave wywołuje `updateNotebookPage`; brak utraty treści przy szybkich zmianach; stan „zapisano" | **P0** |
| B3 | Integration (BE, real DB) | `tests/integration/notebook-persistence.db.test.ts` (RUN_DB_TESTS) | Realny roundtrip PG: capture→listPages→getPage→updatePage→deletePage (soft); wykrycie schema-drift kolumn `capture_source/attachments_json/converted_to_json` | **P0** |
| B4 | Unit (BE) | uzupełnić `notebookService.contract.test.ts` | Zamienić 8 `it.todo` na realne testy (capture upload/url, listPages paginacja, getPage, updatePage, deletePage, addAttachment, removeAttachment) | **P1** |
| B5 | Integration (BE) | `tests/integration/notebook-conversion-handoff.test.ts` | Realny `convertNotebookPage` → wpis `tool_sessions` + krawędź `link_graph_edges` dla →output/→zadanie/→Canvas (nie tylko payload) | **P1** |
| B6 | E2E | `tests/e2e/smoke/notebook-core-flow.spec.ts` | Login → utwórz notatnik → wpisz treść → autosave → SlashMenu blok → konwersja do outputu; smoke renderu strony | **P1** |
| B7 | Component (FE) | poprawka + asercja w `NotebookContextPanel.outputs.test.tsx` | Asercja unikalności kluczy linkowanych outputów (dedup `backlink-*`) — utrwalić fix realnego bugu | **P2** |
| B8 | Integration (BE) | `tests/integration/notebook-capture-ingest.test.ts` | Realny ingest: extractText (docx/pdf) + chunking + embedding (lub deterministyczny stub) → wpisy FTS/embedding; obecnie wszystko mock | **P2** |
| B9 | Component/Unit | `tests/.../AICommandPrompt.test.tsx` | AICommandPrompt + AITopicsPanel: stany ładowania/błędu/degraded, wstawienie proposala do edytora | **P2** |

---

## Werdykt

22 plików, **253 PASS / 0 FAIL / 8 todo**, ~3.7 s. Wszystkie suite zielone, ale zieleń jest **wąska i częściowo pozorna**: rdzeń modułu — edytor TipTap, autosave, SlashMenu — nie ma testów; „AI ekstrakcja" nie istnieje jako AI; trwałość i konwersje są w całości zamockowane; brak e2e; na branchu Londyn brak bramki PR. Najwyższe ryzyko regresji leży dokładnie tam, gdzie testów nie ma (S3, S4, S5).
