# TESTY — M04 Notatnik (My Work → Notatki)

> **Moduł:** M04 Notatnik (`/my-work` → Notatki) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** pełny moduł notatnika — biblioteka L1 (lista notatników), edytor TipTap L3 + autosave, SlashMenu AI, ekstrakcja akcji → zadania, konwersje encji, AI Proposals, Capture API, klasyfikacja, personal/team + ACL, embeddingi/semantic search, fallback V8→legacy.
> **Audyt:** 85/100, brak P0. Po fixach P1/P2 (numberose, 403-fallback, bulk-provenance) — patrz `RAPORT_TESTOW` na końcu.
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować cały cykl życia notatki — z weryfikacją end-to-end (UI przód + stan/DB tył).
> **Data:** 2026-06-14

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Hierarchia (3 poziomy)
- **L1 — lista notatników** (`notebooks`): `src/components/MyWork/NotebookLibraryContent.tsx`. Kontener należy do osoby (`owner_user_id`), jest **cross-project** (NIE bound do `project_id`).
- **L2 — workspace notatnika**: lista kart-notatek wewnątrz wybranego notatnika.
- **L3 — karta notatki** (`notebook_pages`): edytor TipTap, `src/components/MyWork/NotebookContent.tsx`.

### Dwie niezależne osie kontenera (`notebooks`)
| Oś | Wartości | Znaczenie |
|---|---|---|
| `scope` | `personal` \| `team` | kto może otwierać/edytować (`team_id` wymagane gdy `team`) |
| `context_sharing` | `private` \| `org_context` | czy treść zasila kontekst AI organizacji |

### Tabele DB (cztery główne + integracje)
| Tabela | Plik migracji | Kluczowe kolumny |
|---|---|---|
| `notebooks` | `server/migrations/20260602_notebook_containers.sql` | `id, owner_user_id, organization_id, title, icon, scope, team_id, context_sharing` |
| `notebook_pages` | `server/migrations/20260306_notebook_pages.sql` (+ `651_v4`) | `id, owner_user_id, organization_id, project_id, notebook_id, visibility(private\|project), title, content_json, content_text, tags_json, capture_source, capture_metadata` |
| `notebook_embeddings` | `server/migrations/651_v4_notebook_capture_pipeline.sql` | `id, organization_id, page_id, chunk_index, chunk_text, embedding_vector` |
| `notebook_ai_proposals` | `server/migrations/651_v4_notebook_capture_pipeline.sql` | `id, organization_id, page_id, actor_id, proposal_type, block_content, rationale, status(proposed\|...), resolved_at, resolved_by` |

> **UWAGA bigint/JSONB:** node-pg zwraca `content_json`/`tags_json`/`capture_metadata` jako TEXT/JSON-string — przy weryfikacji „tył/DB" parsuj je (patrz `finding_pg_bigint_jsonb_serialization`). Sprawdzaj realny string w kolumnie, nie obiekt JS z aplikacji.

### Warstwa routingu — V8 vs legacy (KRYTYCZNE dla fallbacku)
Front woła najpierw endpointy **V8** (`/api/v8/notebook/*`, `server/src/routes/v8/notebook.routes.ts`). Gdy V8 odmawia, `src/services/api.ts` przełącza się na **legacy** (`/api/my-work/notebook/*`, `server/src/routes/my-work/notebook.routes.ts`).

- `shouldFallbackToLegacyMyWorkNotebook(error)` — `src/services/api.ts:16284`. **Po FIX 2** lista statusów = `[400, 403, 404, 405, 500, 501, 503]`. **403 dodano** bo `v8Auth` zwraca 403 przy braku kontekstu V8 (miss-config na proddzie) → bez tego strony notatek białoekranowały.
- `shouldLockLegacyMyWorkNotebookMode(error)` — `:16288` — `[404, 405, 501]` lub `code==='V8_DISABLED'` → trwałe zablokowanie w trybie legacy (sessionStorage `consultify:notebook-legacy-mode`).
- `shouldPreferLegacyMyWorkNotebook()` — odczyt sticky-flagi.

### Endpointy backendu (skrót — zweryfikuj na żywo)
- **CRUD notatników (L1):** `GET/POST /notebooks`, `GET/PUT/DELETE /notebooks/:id` — `server/src/routes/my-work/notebook.routes.ts:188-360`.
- **CRUD stron (L3):** `GET/POST /notebook/pages`, `PUT/DELETE /notebook/pages/:id`, `/pin`, `/status` — `:395-1332`.
- **Załączniki:** `/notebook/pages/:id/attachments` (+ download/delete), `/source-file` — `:842-1005`.
- **Konwersja:** `POST /notebook/pages/:id/convert` — `:1332`; serwis `server/src/services/notebookConversionService.ts` (targety: `task|decision|initiative|report|presentation|assessment`).
- **Ekstrakcja akcji:** `POST /notebook/pages/:id/extract-actions` — `:1391`.
- **Sugerowanie tematów:** `POST /notebook/pages/:id/suggest-topics` — `:1484`.
- **Klasyfikacja:** `POST /notebook/pages/:id/classify` — `:1613`.
- **Capture API:** `/capture/web-clip`, `/capture/email`, `/capture/upload`, `/capture/import` — `server/src/routes/notebook.routes.ts:54-158`.
- **Semantic search / RAG:** `/search`, `/rag-context` — `notebook.routes.ts:183-207` (oraz V8 `/search` `:73`).
- **AI Proposals:** `GET/POST /pages/:pageId/ai-proposals`, `POST /ai-proposals/:proposalId/resolve` — `notebook.routes.ts:246-294`.
- **Embed chips:** `POST /embed-chips/resolve` — `:327`.

### Setup środowiska testowego
1. Uruchom dev server (preview), zaloguj jako użytkownik z aktywną organizacją (owner DBR77).
2. DevTools → Network (filtr `notebook`) + Console (zero błędów = wymóg).
3. Miej: plik testowy (PDF/DOCX/PNG), URL publiczny do web-clip, notatkę z listą zadań („do zrobienia: …").
4. **Dostęp do DB** (Railway): potrzebny do dowodu „tył/DB". PROD=centerbeam — NIE modyfikuj danych prod; testuj na staging/lokalnie (patrz `feedback_prod_caution`).

> **Legenda:** **[MANUAL]** = headless-only / wymaga oka człowieka; **[FLAG]** = zależne od feature-flag; **[DB]** = wymaga zaglądnięcia do tabeli.

---

## 1. Biblioteka L1 — lista notatników (`NotebookLibraryContent.tsx`)

### 1.1 Lista notatników
- **Kroki:** wejdź na My Work → Notatki.
- **Oczekiwane:** lista kart notatników; każda pokazuje tytuł, ikonę, scope-badge (Personal/Team), liczbę notatek; pusty stan z CTA „Utwórz notatnik" gdy brak.
- **Dowód:** przód = screenshot listy. Tył = `SELECT id,title,scope,context_sharing FROM notebooks WHERE owner_user_id=…` — liczba i nazwy zgodne. **[DB]**

### 1.2 Create notatnik
- **Kroki:** „Utwórz notatnik", podaj tytuł + ikonę, scope=personal.
- **Oczekiwane:** `POST /notebooks` 200; nowa karta na liście bez reloadu.
- **Dowód:** Network payload + nowy wiersz w `notebooks` z poprawnym `owner_user_id`/`organization_id`. **[DB]**

### 1.3 Edit notatnik
- **Kroki:** zmień tytuł/ikonę istniejącego notatnika.
- **Oczekiwane:** `PUT /notebooks/:id` 200; karta odświeżona.
- **Dowód:** `updated_at` zmienione w DB. **[DB]**

### 1.4 Delete notatnik
- **Kroki:** usuń notatnik (z potwierdzeniem).
- **Oczekiwane:** `DELETE /notebooks/:id` 200; znika z listy; zachowanie dla notatnika z notatkami (kaskada vs blokada) — **odnotuj faktyczne**.
- **Dowód:** brak wiersza w `notebooks`; sprawdź los powiązanych `notebook_pages` (czy `notebook_id` osierocone czy usunięte). **[DB]**

### 1.5 Archive — wyłączone by-design
- **Kroki:** poszukaj akcji „Archiwizuj" na notatniku.
- **Oczekiwane:** **brak/disabled** — notatniki NIE mają archiwizacji (by-design; w przeciwieństwie do tabel z lifecycle). Jeśli przycisk istnieje i jest aktywny → FAIL (regresja względem decyzji).
- **Dowód:** screenshot menu kontekstowego notatnika.

---

## 2. Edytor TipTap (L3) + autosave (`NotebookContent.tsx`, `extensions.ts`)

### 2.1 Otwieranie notatki
- **Kroki:** klik karty notatki.
- **Oczekiwane:** edytor TipTap renderuje `content_json`; tytuł edytowalny; toolbar (`NotebookToolbar.tsx`) widoczny.
- **Dowód:** treść zgodna z `content_json` w DB. **[DB]**

### 2.2 Edycja + autosave
- **Kroki:** wpisz tekst, formatuj (bold/H1/lista), odczekaj debounce.
- **Oczekiwane:** autosave `PUT /notebook/pages/:id` (sprawdź debounce, brak zapisu per-keystroke); wskaźnik „zapisano".
- **Dowód:** Network — jedno wywołanie po przerwie, nie 20; `content_json` + `content_text` zaktualizowane w DB; `updated_at` świeże. **[DB]**

### 2.3 Autosave — odporność
- **Kroki:** edytuj, odśwież stronę przed/po debounce.
- **Oczekiwane:** zmiany sprzed ostatniego zapisu zachowane; brak utraty po reloadzie gdy zapis się dokonał.
- **Dowód:** treść po reloadzie = treść w DB.

### 2.4 Konkurencyjna edycja [MANUAL]
- **Kroki:** otwórz tę samą notatkę w dwóch kartach, edytuj w obu.
- **Oczekiwane:** odnotuj zachowanie last-write-wins / ostrzeżenie (patrz lekcja N-1 edit-clobber z M01/M02 — sprawdź czy notatnik ma ten sam problem). Jeśli cicha utrata → zgłoś jako bug.

---

## 3. SlashMenu AI (`SlashMenu.tsx`, `AICommandPrompt.tsx`, `AIInlineResponse.tsx`)

> Komendy formatujące (H1-H3, listy, todo) — `SlashMenu.tsx:43+`. Komendy AI (`aiCommand`): **ask / expand / challenge / action** — prompty w `AIInlineResponse.tsx:21-39`.

### 3.1 Wywołanie slash menu
- **Kroki:** wpisz `/` na początku linii.
- **Oczekiwane:** menu z komendami; filtrowanie po wpisanym tekście (keywords PL+EN); strzałki/Enter wybierają; Esc zamyka.
- **Dowód:** screenshot; po wyborze formatu — odpowiedni blok TipTap.

### 3.2 AI: ask
- **Kroki:** `/ask` (lub odpowiednik) → wpisz pytanie w `AICommandPrompt`.
- **Oczekiwane:** odpowiedź AI w `AIInlineResponse`; odpowiada w języku notatki (prompt `ask.pl/en` `:24-26`).
- **Dowód:** Network wywołanie AI; treść odpowiedzi sensowna.

### 3.3 AI: expand
- **Kroki:** `/expand` na akapicie.
- **Oczekiwane:** rozwinięcie akapitu, ten sam styl/ton/język, BEZ powtórzenia oryginału (prompt `:28-29`).
- **Dowód:** odpowiedź to rozszerzenie, nie kopia.

### 3.4 AI: challenge — **regresja FIX 1**
- **Kroki:** `/challenge` na notatce z założeniami; uruchom w **EN** i **PL**.
- **Oczekiwane:** 3-5 krytycznych pytań sformatowanych jako **lista numerowana**.
- **Krytyczne (FIX 1):** prompt EN `AIInlineResponse.tsx:32` musi brzmieć `"Format as a numbered list."` — **NIE** `numberose` (codemod red→rose zepsuł). PL `:33` = „listę numerowaną" (poprawne). Sprawdź, że odpowiedź faktycznie jest numerowana (1. 2. 3.).
- **Dowód:** odpowiedź EN ponumerowana; przegląd promptu w kodzie po fixie.

### 3.5 AI: action — **regresja FIX 1**
- **Kroki:** `/action` na notatce; EN + PL.
- **Oczekiwane:** 3-5 konkretnych kroków (co/kto/termin), lista numerowana.
- **Krytyczne (FIX 1):** prompt EN `AIInlineResponse.tsx:36` = `"Format as a numbered list."` (poprawione z `numberose`). PL `:37` poprawne.
- **Dowód:** odpowiedź EN ponumerowana.

### 3.6 Wstawianie odpowiedzi AI do notatki
- **Kroki:** zaakceptuj odpowiedź AI (insert).
- **Oczekiwane:** treść trafia do edytora; autosave zapisuje.
- **Dowód:** `content_json` w DB zawiera wstawiony blok. **[DB]**

---

## 4. Ekstrakcja akcji → zadania (`ActionItemsPanel.tsx`, `/extract-actions`)

### 4.1 Ekstrakcja
- **Kroki:** otwórz panel „Action items" na notatce z listą do-zrobienia.
- **Oczekiwane:** `POST /notebook/pages/:id/extract-actions` zwraca listę pozycji (title, priority); panel je renderuje (`ActionItemsPanel.tsx:65-67` auto-extract on open).
- **Dowód:** Network odpowiedź + lista w UI.

### 4.2 Single-create z provenance
- **Kroki:** „Utwórz" pojedynczy task.
- **Oczekiwane:** `Api.createPersonalTask` z `sourceType:'notebook_page'` + `sourceId:noteId` (`ActionItemsPanel.tsx:79-80`); tagi `from-notebook`, `ai-extracted`; toast „Task utworzony".
- **Dowód:** nowy wiersz w `tasks` z `source_type='notebook_page'` i `source_id` = id notatki. **[DB]**

### 4.3 Bulk „Utwórz wszystkie" — **regresja FIX 3**
- **Kroki:** „Utwórz wszystkie" na ≥2 pozycjach.
- **Oczekiwane:** pętla tworzy wszystkie taski; toast „Utworzono N tasków".
- **Krytyczne (FIX 3):** po fixie pętla (`ActionItemsPanel.tsx:102-110`) zawiera **`sourceType:'notebook_page'` + `sourceId:noteId`** — masowe taski mają link do notatki tak samo jak single-create. Przed fixem provenance było gubione.
- **Dowód:** **WSZYSTKIE** nowo utworzone wiersze w `tasks` mają niepuste `source_type='notebook_page'` + `source_id`. Sprawdź konkretnie te z bulk, nie tylko single. **[DB]**

### 4.4 Idempotencja / podwójne kliknięcie
- **Kroki:** szybki double-click „Utwórz".
- **Oczekiwane:** brak duplikatów (guard `createdIds`/`creatingIdx`).
- **Dowód:** liczba wierszy w `tasks` = liczba pozycji, nie więcej.

---

## 5. Konwersje notatki → encje (`/convert`, `notebookConversionService.ts`)

> Serwis: `server/src/services/notebookConversionService.ts`. Targety: `task`, `decision`, `initiative`, `report`, `presentation`, `assessment`. Po konwersji notatka zapisuje provenance w `converted_to_json`.

Dla **każdego** targetu — kroki / oczekiwane / dowód (przód + DB):

### 5.1 → task
- `POST /convert {target:'task'}` → wiersz w `tasks`; `created_entity` w odpowiedzi; toast + link. **[DB]**

### 5.2 → decision
- `target:'decision'` → wiersz w `decisions` (`decision_maker_id`=user). **[DB]**

### 5.3 → initiative
- `target:'initiative'` → wiersz w `initiatives` (sprawdź provenance link `containerType:'mywork_convert'`). **[DB]**

### 5.4 → assessment
- `target:'assessment'` + `assessmentType` (DRD/SIRI/ADMA/CMMI/LEAN) → utworzony assessment właściwego typu. **[DB]** **[FLAG]** jeśli typ za flagą.

### 5.5 → report
- `target:'report'` → `createReport` (`reportBuilderService`); raport powstaje z treści notatki. **[DB]**

### 5.6 → presentation
- `target:'presentation'` → `generateOutline` (`presentationGeneratorService`); deck powstaje. **[DB]**

### 5.7 Provenance po konwersji
- **Oczekiwane:** `notebook_pages.converted_to_json` notatki zawiera wpis o utworzonej encji (typ, id).
- **Dowód:** `SELECT converted_to_json FROM notebook_pages WHERE id=…` zawiera nowy wpis. **[DB]**

### 5.8 → Canvas „Rozwiń w dokument" (`notebookExpandToDocument.ts`) **[FLAG]**
- **Kroki:** akcja „Rozwiń w dokument" na notatce.
- **Oczekiwane:** `notebookContentToMarkdown` konwertuje `content_json`→markdown; `buildNotebookExpandDraftBody` + `expandNotebookPageToCanvasDraft` tworzą draft; `buildExpandChatUrl(draftId)` → SPA-nawigacja do chatu z otwartym Canvas (KROK 6 / C3).
- **Krytyczne flag:** Canvas/Deliverables-light zależy od `VITE_ENABLE_DELIVERABLES_LIGHT` (patrz `finding_deliverables_vite_flag_deploy`) — na Railway flaga musi być ustawiona, inaczej „nigdy nie działało". Odnotuj stan flagi w środowisku testu.
- **Dowód:** Canvas otwiera się z treścią notatki jako draftem dokumentu; URL = chat z `draftId`.

---

## 6. AI Proposals (`/pages/:pageId/ai-proposals`, `/resolve`, `notebook_ai_proposals`)

### 6.1 Lista propozycji
- **Kroki:** otwórz notatkę z aktywnymi propozycjami AI.
- **Oczekiwane:** `GET /pages/:pageId/ai-proposals` zwraca wiersze ze `status='proposed'`; UI pokazuje propozycje z `rationale`.
- **Dowód:** lista UI = wiersze w `notebook_ai_proposals` (status proposed). **[DB]**

### 6.2 Tworzenie propozycji
- **Kroki:** wywołaj akcję AI generującą propozycję bloku.
- **Oczekiwane:** `POST /pages/:pageId/ai-proposals` → nowy wiersz (`proposal_type`, `block_content`, `actor_id`).
- **Dowód:** wiersz w DB. **[DB]**

### 6.3 Accept
- **Kroki:** „Akceptuj" propozycję.
- **Oczekiwane:** `POST /ai-proposals/:proposalId/resolve {status:'accepted'}`; blok wstawiony do `content_json`; `status` zmienione, `resolved_at`/`resolved_by` ustawione.
- **Dowód:** propozycja status≠proposed; treść w `content_json` notatki. **[DB]**

### 6.4 Reject
- **Kroki:** „Odrzuć".
- **Oczekiwane:** `resolve {status:'rejected'}`; blok NIE trafia do treści; status zmieniony.
- **Dowód:** `content_json` bez bloku; `status='rejected'` + `resolved_*`. **[DB]**

---

## 7. Capture API (`server/src/routes/notebook.routes.ts:54-158`)

> Endpointy ustawiają `notebook_pages.capture_source` + `capture_metadata`. UI: `notebookCaptureSourceSummary.ts`.

### 7.1 web-clip
- **Kroki:** `POST /capture/web-clip` z URL.
- **Oczekiwane:** nowa strona z `capture_source='web-clip'`, treść z URL, metadata (url/title).
- **Dowód:** wiersz `notebook_pages` z `capture_source='web-clip'` + sensowne `capture_metadata`. **[DB]** **[MANUAL]** (potrzebny realny URL).

### 7.2 email
- **Kroki:** `POST /capture/email` z treścią maila.
- **Oczekiwane:** strona z `capture_source='email'`.
- **Dowód:** DB. **[DB]** **[MANUAL]**.

### 7.3 upload
- **Kroki:** `POST /capture/upload` (PDF/DOCX/PNG).
- **Oczekiwane:** strona z `capture_source='upload'` (default); ekstrakcja treści/OCR jeśli wspierane.
- **Dowód:** DB + treść/załącznik. **[DB]**

### 7.4 import
- **Kroki:** `POST /capture/import` (np. markdown/zewnętrzny format).
- **Oczekiwane:** strona z `capture_source='import'`.
- **Dowód:** DB. **[DB]** **[MANUAL]**.

### 7.5 Podsumowanie źródła w UI
- **Oczekiwane:** karta notatki pokazuje badge źródła (`notebookCaptureSourceSummary.ts`, `NotebookMetadataBadges.tsx`).
- **Dowód:** screenshot badge zgodny z `capture_source`.

---

## 8. Klasyfikacja (`/classify`)

- **Kroki:** `POST /notebook/pages/:id/classify` na notatce.
- **Oczekiwane:** AI zwraca tagi/kategorie; zapisane w `tags_json`; UI odświeża badge.
- **Dowód:** `tags_json` w DB zawiera nowe tagi; przód pokazuje je. **[DB]**
- Sprawdź też `/suggest-topics` (`:1484`, `AITopicsPanel.tsx`) — sugerowane tematy renderowane i akceptowalne.

---

## 9. Personal vs Team + ACL

### 9.1 Personal notatnik
- **Kroki:** utwórz `scope='personal'`.
- **Oczekiwane:** widoczny tylko dla ownera; inny user (ta sama org) go NIE widzi.
- **Dowód:** zaloguj innego usera → notatnik nieobecny; w DB `scope='personal'`, brak `team_id`. **[DB]** **[MANUAL]** (dwa konta).

### 9.2 Team notatnik
- **Kroki:** utwórz `scope='team'` z `team_id`.
- **Oczekiwane:** widoczny dla członków zespołu; edytowalny wg ACL; nie-członek nie widzi.
- **Dowód:** członek widzi, nie-członek 403/brak; DB `scope='team'` + `team_id`. **[DB]** **[MANUAL]**.

### 9.3 context_sharing
- **Kroki:** ustaw `context_sharing='org_context'` na notatniku.
- **Oczekiwane:** treść notatek zasila kontekst AI org (sprawdź czy Teresa/Anna „widzi" treść); `private` = nie zasila.
- **Dowód:** zapytaj AI o fakt z notatki org_context vs private — różnica; DB flaga. **[DB]** **[MANUAL]**.

### 9.4 ACL na poziomie strony (`visibility`)
- **Kroki:** strona `visibility='private'` vs `'project'`.
- **Oczekiwane:** project-visible strona dostępna w kontekście projektu; private tylko ownerowi.
- **Dowód:** DB `notebook_pages.visibility`. **[DB]**

---

## 10. Embeddingi / semantic search (`notebook_embeddings`, `/search`, `/rag-context`)

### 10.1 Generowanie embeddingów
- **Kroki:** utwórz/edytuj notatkę z treścią; odczekaj na pipeline.
- **Oczekiwane:** chunki w `notebook_embeddings` (`page_id`, `chunk_index`, `chunk_text`, `embedding_vector` niepusty).
- **Dowód:** `SELECT count(*) FROM notebook_embeddings WHERE page_id=…` > 0; `embedding_vector` wypełniony. **[DB]** **[FLAG]** (pipeline może być za flagą/asynchroniczny).

### 10.2 Semantic search
- **Kroki:** `POST /search` (V8 `:73` lub legacy `:183`) z zapytaniem semantycznym (nie dosłownym).
- **Oczekiwane:** zwraca trafne notatki rankowane podobieństwem, nie tylko exact-match.
- **Dowód:** wyniki zawierają notatkę pasującą znaczeniowo bez dosłownego słowa; Network odpowiedź.

### 10.3 RAG context
- **Kroki:** `POST /rag-context` (`:207`).
- **Oczekiwane:** zwraca fragmenty notatek jako kontekst dla AI; respektuje `context_sharing`/ACL (private notatki innych userów NIE wyciekają).
- **Dowód:** kontekst zawiera tylko dozwolone fragmenty. **[MANUAL]** (sprawdź izolację).

---

## 11. Fallback V8 → legacy (w tym **FIX 2** — 403)

### 11.1 Happy path V8
- **Kroki:** normalne ładowanie listy notatników (org z V8).
- **Oczekiwane:** wołania `/api/v8/notebook/*` 200; brak fallbacku.
- **Dowód:** Network — endpointy v8, nie legacy.

### 11.2 Fallback na legacy — 403 (**FIX 2, regresja prod-whitescreen**)
- **Kroki:** zasymuluj odpowiedź 403 z v8Auth (org bez kontekstu V8 / miss-config). Np. konto/org gdzie `v8Auth` odmawia.
- **Oczekiwane:** front **NIE białoekranuje** — `shouldFallbackToLegacyMyWorkNotebook` zwraca `true` dla 403 (`api.ts:16286` po fixie lista zawiera `403`) → przełącza na `/api/my-work/notebook/*`, lista notatek się ładuje.
- **Krytyczne:** przed fixem 403 NIE było na liście → fallback nie odpalał → biały ekran na proddzie. Po fixie strona działa w trybie legacy.
- **Dowód:** Network — po 403 z v8 następuje wywołanie legacy; UI pokazuje notatki, brak białego ekranu, brak crasha w Console. **[MANUAL]** (wymaga org/konta wyzwalającego 403, albo mock 403 w testach jednostkowych api.ts).

### 11.3 Inne statusy fallbacku
- **Kroki:** zweryfikuj 400/404/405/500/501/503 → fallback (jednostkowo lub przez przechwycenie).
- **Oczekiwane:** każdy z listy `[400,403,404,405,500,501,503]` wyzwala fallback.
- **Dowód:** test jednostkowy `shouldFallbackToLegacyMyWorkNotebook` per status.

### 11.4 Lock legacy mode
- **Kroki:** wywołaj 404/405/501 lub `code='V8_DISABLED'`.
- **Oczekiwane:** `shouldLockLegacyMyWorkNotebookMode` → `true`; sticky flag `consultify:notebook-legacy-mode='1'` w sessionStorage; kolejne wywołania od razu legacy bez próby V8.
- **Dowód:** sessionStorage flag = '1'; brak ponownych prób v8 do końca sesji. **[DB n/d — sessionStorage]**.

### 11.5 Parytet danych V8 vs legacy
- **Kroki:** porównaj listę notatek przez V8 i przez legacy.
- **Oczekiwane:** ta sama treść (oba czytają te same tabele) — fallback nie gubi danych.
- **Dowód:** identyczny zestaw notatek w obu trybach.

---

## 12. Testy przekrojowe (cross-cutting)

1. **i18n PL/EN:** wszystkie etykiety, toasty, prompty AI (w tym challenge/action po FIX 1 — EN „numbered", PL „numerowaną"). **[MANUAL]**
2. **Dark mode:** edytor, slash menu, panele (ActionItems/Proposals/Topics) czytelne. **[MANUAL]**
3. **A11y:** focus w edytorze, klawiatura w slash menu (strzałki/Enter/Esc), role w menu.
4. **Console:** zero błędów/warningów przez całą sesję.
5. **Provenance spójność:** task z bulk (FIX 3) i task z single mają TEN SAM kształt provenance (`source_type`/`source_id`). **[DB]**
6. **Brak martwego kodu:** potwierdź, że `src/utils/notebookStorage.ts` został usunięty (FIX 4 — 0 importerów) i nic się nie zepsuło (`grep -rn notebookStorage src server` = 0).
7. **Izolacja org/ACL:** notatki jednej org/usera nie wyciekają do drugiej (lista, search, rag-context).

---

## 13. Testy regresji / jednostkowe
- Uruchom: `server/src/routes/v8/__tests__/my-work-notebook.routes.test.ts`, `server/src/routes/__tests__/my-work-notebook.routes.test.ts`, `server/src/routes/v8/__tests__/p07-notebook-canon.test.ts`, `src/components/MyWork/__tests__/NotebookLibraryContent.smoke.test.tsx`.
- **Dopisz** (jeśli brak): test jednostkowy `shouldFallbackToLegacyMyWorkNotebook` sprawdzający że **403 ∈ lista** (regression guard dla FIX 2).
- **Dopisz** (jeśli brak): test `ActionItemsPanel` handleCreateAll → payload każdego wywołania zawiera `sourceType:'notebook_page'`+`sourceId` (regression guard dla FIX 3).

---

## 14. Format raportu (dla każdej pozycji)
Dla każdego punktu podaj: **kroki → oczekiwane → faktyczne → status (PASS/FAIL) → dowód** (screenshot UI = przód + zrzut DB/Network = tył). Dla FAIL: `plik:linia`, przyczyna, propozycja fixu. Zaznacz [MANUAL]/[FLAG] gdzie dotyczy.

**Definition of Done:** wszystkie pozycje PASS; E2E provenance + fallback 403 potwierdzone w DB/Network; zero błędów w konsoli; PL i EN; light i dark; testy jednostkowe regresji (403, bulk-provenance) zielone.
