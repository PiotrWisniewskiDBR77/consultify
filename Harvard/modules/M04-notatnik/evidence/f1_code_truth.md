# M04 — Notatnik (Notebook) — FAZA 1: PRAWDA KODU

Branch: `feat/deliverables-light`. Metoda: czytanie kodu runtime (dokumenty = hipotezy ~7:1).

## Mapa runtime (co naprawdę odpalają trasy FE)

- **L1 Biblioteka notatników** → FE `Api.getNotebooks/createNotebook/updateNotebook/deleteNotebook`
  (`src/services/api.ts:16351-16406`) → **`GET/POST/PUT/DELETE /api/my-work/notebooks`**.
- **L2 Strony** → FE `Api.getNotebookPages/getNotebookPage/...` (`src/services/api/v8/my-work.ts:289-397`)
  → **`/api/my-work/notebook/pages*`**.
- Oba serwowane przez **`server/src/routes/my-work/notebook.routes.ts`** (1695 linii), mount: `Gateway.ts:745` `app.use('/api/my-work', myWorkRoutes)`.
- Trzy pliki tras istnieją:
  - `routes/my-work/notebook.routes.ts` — **ŻYWY hub** (CRUD/strony/załączniki/convert/AI).
  - `routes/notebook.routes.ts` (359) — **ŻYWY, ale poza hubem**: Capture API (`/api/notebook`, deprecation→`/api/v8/notebook`, `Gateway.ts:773`).
  - `routes/v8/notebook.routes.ts` (493) — **ŻYWY**: search/handoff-builder/contract (`/api/v8/notebook`, `v8/index.ts:71`).

## PERSISTENCJA — REALNA DB (nie fasada, nie `notebook_entries`)

- Tabele **`notebooks`** (L1) i **`notebook_pages`** (L2). Migracje: `20260602_notebook_containers.sql` (notebooks), `20260306_notebook_pages.sql`, + maturity/attachments/status/pinned/fts/lifecycle.
- **NIE używa martwej `notebook_entries`** z M21 — to inny moduł. Notebook pisze prawdziwym `INSERT INTO notebooks`/`notebook_pages` (`notebook.routes.ts:241,666`; `notebookService.ts:258`).
- Strony przeżyją restart (Postgres/SQLite, `queryHelpers.queryRun`). Default notebook „Moje notatki" tworzony idempotentnie (`ON CONFLICT DO NOTHING`, `notebook.routes.ts:643-660`).

## WERDYKTY PER POZYCJA (19)

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 1 | Biblioteka L1 (filtry/liczniki) | **REALNE** | `NotebookLibraryContent.tsx:33,156,178-180` (scope all/personal/team, liczniki z `n.scope`); route `notebook.routes.ts:187-209` z `page_count` podzapytaniem |
| 2 | Nowy notatnik CTA | **REALNE** | `Api.createNotebook` → `POST /notebooks` `notebook.routes.ts:215-254` (insert do `notebooks`) |
| 3 | CRUD notatnika (rename/archive/delete) | **REALNE** | `notebook.routes.ts:282-389` (PUT owner-only, DELETE owner-only + odmowa gdy niepusty 409). UWAGA: brak osobnego „archive" notatnika-kontenera (archive jest na poziomie STRONY, nie kontenera) |
| 4 | Lista stron + edytor TipTap | **REALNE** | `NotebookContent.tsx` 2956 linii, TipTap z rozszerzeniami; pages route `notebook.routes.ts:394-510` |
| 5 | SlashMenu (bloki + AI + create-*) | **REALNE** | `SlashMenu.tsx:45-243` formatowanie = komendy TipTap; `ai-*` ustawiają `aiCommand`; `create-task/decision/save-as-idea` dispatch CustomEvent → handlery w `NotebookContent.tsx:1171+` (create-task = real `Api.createPersonalTask` + link edge `:1177,1187`) |
| 6 | Ekstrakcja akcji AI (SSE) | **REALNE (LLM)** | `notebook.routes.ts:1388-1475` realny `llmService.callText` + `modelRouter`, SSE; FE `ActionItemsPanel.tsx:45` `streamNotebookActionExtraction` → `:73,102` `createPersonalTask` (akcje → realne zadania) |
| 7 | Sugestie tematów AI | **REALNE (LLM)** | `notebook.routes.ts:1481-1604` realny LLM, z fallbackiem heurystycznym przy błędzie (`:1574-1599`) |
| 8 | Inline czat AI + konwersja na cele | **REALNE (LLM) + KORUPCJA „rose"** | `AIChatInlinePanel.tsx:227` `Api.chatWithAIStream` (real stream LLM), wynik wstawiany jako callout `:245-259`; konwersja na cele = `onConvert`→backend convert (real). **Korupcja codemodu potwierdzona** (niżej) |
| 9 | Auto-klasyfikacja (debounce 2s) | **REALNE ale HEURYSTYKA (nie LLM)** | FE `NotebookContent.tsx:1295-1335` `setTimeout(classify, 2000)` → `Api.classifyNotebookPage`; backend `notebook.routes.ts:1610-1692` = **keyword-scoring**, NIE LLM (mimo nazwy „AI") |
| 10 | WorkspacePanelStrip (czat/kontekst/AI) | **CZĘŚCIOWO MYLNE** | Notebook NIE renderuje `WorkspacePanelStrip` — używa `AIChatInlinePanel` jako panel roboczy. `WorkspacePanelStrip` realny tylko w `IdeaMapWorkspace.tsx:26` (i to tylko import typu) |
| 11 | Załączniki (upload/download/delete) | **REALNE** | `notebook.routes.ts:879-1088` (multer 25MB; `addNotebookAttachmentsToPage`/`resolveNotebookAttachmentFile`/`removeNotebookAttachmentFromPage`) — realny serwis plików |
| 12 | Pin/status strony | **REALNE** | `notebook.routes.ts:1255-1323` (PUT pin toggle, PUT status inbox/active/converted/archived) |
| 13 | Konwersja strony → output | **REALNE (convert) / PÓŁ-MARTWE (handoff)** | `/convert` (`notebook.routes.ts:1329-1382`) → `notebookConversionService.ts` realnie INSERT do `tasks/decisions/initiatives/assessments` + `report`/`presentation` przez realne serwisy + `link_graph_edges`. **ALE** przyciski „Wyślij do Radar/Inicjatyw" (`NotebookContent.tsx:1651,1667`) → `/v8/notebook/handoff/*` które **tylko budują payload, NIC nie persistują** (niżej) |
| 14 | Konwersja checklisty → zadania | **REALNE** | `ConvertChecklistModal.tsx:87` `Api.createPersonalTask` z parsowanych task-list itemów |
| 15 | Expand do dokumentu Canvas | **REALNE** | `notebookExpandToDocument.ts:223` `POST /api/work-canvas/drafts` → deep-link `/chat?workPanel=1&canvasDraftId=…` (`:210`); realny handoff do M02 |
| 16 | Szablony nowej strony | **REALNE** | `NotebookContent.tsx` template modal (`templateModalOpen`, skrót ⌘⇧N `:1120-1122`); `createNotebookPage` przyjmuje `template` |
| 17 | Strip ścieżki kanonicznej | **REALNE** (UI) | breadcrumb w `NotebookContent`/`NotebookLibraryContent` (canon §3.3 liczniki) — element prezentacyjny |
| 18 | Capture API (web-clip/email/upload/import/search/rag/embed-chips) | **REALNE — zasilane spoza huba** | `routes/notebook.routes.ts:53-350` wszystkie 4 źródła + `/search` (semanticSearch) + `/rag-context` + `/ai-proposals` + `/embed-chips/resolve`, backend `notebookService.capture` (`notebookService.ts:144-215`) obsługuje upload/web_clipper/email_forward/api_import. UI huba woła TYLKO `/notebook/upload` (`my-work/notebook.routes.ts:712`) — reszta dla integracji zewnętrznych |
| 19 | KnowledgePulse.tsx + InsertMenu.tsx | **MARTWY KOD (potwierdzone)** | `KnowledgePulse` — 0 importerów (tylko self-export `:59`; w `MyWorkHub.tsx:1225` jedynie komentarz). `notebook/InsertMenu.tsx` — 0 importerów (Reports używa innego `BlockInsertMenu`) |

## AI — REALNY czy STUB?

- **REALNY LLM**: extract-actions (#6), suggest-topics (#7), inline czat (#8), AI compose w slash ai-ask/expand/challenge/action (#5/#8) — wszystkie przez `llmService.callText` / `chatWithAIStream` + `modelRouter`.
- **HEURYSTYKA udająca „AI"**: auto-klasyfikacja (#9) — czysty keyword-scoring (`notebook.routes.ts:1633-1692`), zero LLM. Działa, ale to nie AI.
- **Fallback heurystyczny**: suggest-topics ma fallback bez LLM przy błędzie (akceptowalne).

## KONWERSJE — ŻYWE vs MARTWE

- **ŻYWE (realny handoff + persistencja)**: → task, → decision, → initiative, → assessment, → report, → presentation (`notebookConversionService.ts`, INSERT-y do realnych tabel + `link_graph_edges`); checklist → zadania; expand → Canvas draft (M02); slash create-task/decision/save-as-idea.
- **PÓŁ-MARTWE / WPROWADZA W BŁĄD**: **handoff „Radar" i „Inicjatywy"** (`/v8/notebook/handoff/radar`, `/handoff/inicjatywy`). Serwis `notebookHandoffService.ts` (619 linii) **NIE MA żadnego INSERT/queryRun/createInitiative** — `buildRadarHandoff`/`buildInitiativeHandoff` tylko składają obiekt-payload i zwracają go (`:429,467`). FE pokazuje toast „Wysłano do Radar/Inicjatyw" (`NotebookContent.tsx:1655,1671`) mimo że **nic nie ląduje** w Radarze ani Inicjatywach. To różni się od realnego `/convert` (target=initiative), który faktycznie tworzy inicjatywę.
- **Uwaga do inwentarza My-Work poz.8 (ConvertTo* MARTWY w shared/ConvertToMenu)**: w Notebooku konwersje nie idą przez `shared/ConvertToMenu` — idą przez `AIChatInlinePanel.onConvert` → `Api.convertNotebookPage` → realny serwis. Więc martwota ConvertToMenu NIE dotyczy żywych konwersji Notebooka.

## KORUPCJA „rose" — POTWIERDZONA (w komentarzach/etykietach, nie w kolorach)

`AIChatInlinePanel.tsx`:
- `:3` komentarz `"Composes sharose Workspace sections"` — codemod podmienił **„shared" → „sharose"**.
- `:449` `{/* ─── AI (sharose) ─── */}`, `:497` `Transform (sharose)`, `:500` `Share (sharose)` — te same uszkodzone etykiety sekcji.
- Klasy koloru `rose-500` (`:392,442,565,614,618`) są **intencjonalne** (delete/destructive + przycisk nagrywania), NIE są korupcją.
- Dodatkowo: panel używa **hardkodowanych klas Tailwind** (`emerald/blue/amber/rose-500`, `:92-104,319-392`) zamiast tokenów designu — dług wizualny, ale funkcjonalnie działa.

Werdykt: korupcja kosmetyczna (komentarze/etykiety sekcji), nie łamie logiki. Do quick-fixu: `sharose`→`shared`.

## SEC — org-scope / cross-org IDOR

Moduł **CZYSTY** względem cross-org IDOR. Wszystkie trasy używają `requireUser` (orgId/userId z auth, nie z URL) i konsekwentnie filtrują:

- `GET /notebook/pages/:id` — `canAccessNotebookRow` (org === orgId + owner OR project-member) `notebook.routes.ts:795`.
- Załączniki download `:id/:attachmentId/download` — `canAccessNotebookRow` `:989` (brak IDOR na pobieraniu plików).
- PUT/DELETE/pin/status strony — `organization_id === orgId` **+ owner-only** `:1111-1114,1241-1244,1269-1272,1311-1314`.
- extract-actions / suggest-topics — org + owner-only `:1403-1406,1496-1499`.
- classify — query z `owner_user_id = ? AND organization_id = ?` `:1622-1624`.
- convert — deleguje z orgId/userId; serwis filtruje org.
- Lista stron — `WHERE np.organization_id = ?` + per-wiersz `canAccessNotebookRow` `:414,472-477`.
- Capture/search (`routes/notebook.routes.ts`) — przekazują `identity.orgId` do serwisu `:197,224`.
- Handoff (`v8`) — `loadNotebookRow` filtruje `id = ? AND organization_id = ?` `notebookHandoffService.ts:322`. Brak per-user check (każdy w tej samej org może zbudować payload dla cudzej notatki) — **niska waga** (ten sam org, tylko payload, brak zapisu).

Wniosek SEC: notatki/strony/załączniki/capture **filtrują `organization_id`**. Notebook należy do „czystych" modułów (jak M02/M17/M18/M21), nie do dziurawych (M20/M16/M15).

## TABELE WIRING (1e)

| Funkcja | Tabela DB / migracja |
|---------|----------------------|
| Notatniki (L1) | `notebooks` — `20260602_notebook_containers.sql` |
| Strony (L2) | `notebook_pages` — `20260306_notebook_pages.sql` (+ maturity/status/pinned/fts/lifecycle/attachments) |
| Załączniki | kolumna `notebook_pages.attachments_json` + serwis plików (`notebookAttachmentService`) |
| Capture (źródłowy plik) | `notebook_pages.capture_source` + `capture_metadata` + `persistNotebookSourceFile` |
| AI proposals | `notebookService.createAIProposal`/`getProposalsForPage` (tabela proposals) |

## POŁĄCZENIA (1g)

- → **M03 tasks/decisions**: `Api.createPersonalTask` (slash, action-items, checklist) + `/convert` target task/decision → `tasks`/`decisions` + `link_graph_edges`. **ŻYWE**.
- → **M17/output (initiative/report/presentation/assessment)**: `/convert` → `notebookConversionService` realnie tworzy encje. **ŻYWE**.
- → **Radar / Inicjatywy (handoff v8)**: **PÓŁ-MARTWE** — builder payloadu bez persistencji; toast wprowadza w błąd.
- → **M02 Canvas expand**: `POST /api/work-canvas/drafts` + deep-link. **ŻYWE**.
- → **M05 save-as-idea**: slash dispatch CustomEvent (handler w NotebookContent). ŻYWE (event-based).
- **Capture spoza huba**: web-clip/email/import zasilają `notebook_pages` przez `/api/notebook/capture/*`; UI huba używa tylko upload. ŻYWE, ale konsumowane przez integracje zewnętrzne, nie przez UI Notebooka.

## NAJWAŻNIEJSZE SYGNAŁY (do FAZY 2)

1. **Handoff Radar/Inicjatywy = fałszywy „Wysłano"** — najpoważniejszy: użytkownik dostaje sukces-toast, a nic nie powstaje po stronie Radaru/Inicjatyw. (`notebookHandoffService` bez INSERT; FE `NotebookContent.tsx:1648-1679`).
2. **Auto-klasyfikacja to heurystyka, nie AI** — keyword-scoring podpięty pod nazwę „AI classify".
3. **Korupcja codemodu „sharose"** — kosmetyczna (komentarze/etykiety) w `AIChatInlinePanel.tsx:3,449,497,500` + hardkody kolorów Tailwind zamiast tokenów.
4. **Martwy kod**: `KnowledgePulse.tsx` i `notebook/InsertMenu.tsx` — 0 konsumentów (kandydaci do usunięcia).
5. **WorkspacePanelStrip** w inwentarzu przypisany do Notebooka jest mylny — Notebook używa `AIChatInlinePanel`; Strip żyje w Ideas/IdeaMap.
6. Pozytyw: persistencja realna (notebooks/notebook_pages), AI realny w 4/5 funkcji, konwersje convert/checklist/Canvas realne, org-scope czysty bez IDOR.
