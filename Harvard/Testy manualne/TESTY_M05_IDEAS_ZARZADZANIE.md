# TESTY — M05 Ideas — Zarządzanie (`/my-work/ideas`)

> **Moduł:** M05 Ideas — Zarządzanie — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** hub listy idei (3 widoki), foldery, ulubione, recents, workspace mapy (4 narzędzia), AI (suggestions/generate/expand/gap), snapshoty, komentarze węzłów, aktywność, konwersja idea→6 outputów, eksport, ścieżki cross-module (Czat→Idea, Notebook→Idea, Ideas→Inicjatywy, Ideas→Canvas, Ideas→Outputs), beta-gating.
> **Poza zakresem:** Mind Map (M06), Process Flow (M07), Table (M08), Whiteboard (M09) — te mają własne paczki testowe.
> **Cel:** agent testujący weryfikuje KAŻDĄ funkcję end-to-end z dowodem w Network + DB; sama zmiana w UI bez żądania = FAIL.
> **Baza:** karta audytu `Harvard/modules/M05-ideas-zarzadzanie/KARTA_AUDYTU.md` + teczka `Harvard/wdrozenie-100/M05-ideas-zarzadzanie.md` + kod zweryfikowany bezpośrednio.
> **Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji (drag&drop / OAuth / realny plik); **[FLAG]** = zależne od flagi / capability / roli; **[DB]** = dowód wymaga wiersza/kolumny w bazie.
> **Data:** 2026-06-16

---

## §0 — Kontekst architektoniczny

### Mapa komponent ↔ plik ↔ stan

| Obszar | Komponent | Plik | Stan / store |
|---|---|---|---|
| Hub (lista + routing) | `MyWorkHub` | `src/components/MyWork/MyWorkHub.tsx` | tab router, sessionStorage |
| Lista idei | `MyIdeasListContent` | `src/components/MyWork/MyIdeasListContent.tsx` | `ideas[]`, `selectedIds`, `viewMode`, `sortField/Dir`, `activeFolderId`, `tableFilters` |
| Workspace mapy | `IdeaMapWorkspace` | `src/components/MyWork/IdeaMapWorkspace.tsx` | `graphNodes`, `graphEdges`, `syncState`, `activePanel`, `selection`, `drillDownStack` |
| Sync persystencji | `useIdeaMapSync` | `src/components/MyWork/canvas/useIdeaMapSync.ts` | `syncState: IdeaMapSyncState`, `serverVersionRef`, `baseVersion` |
| Runtime grafu | `useWorkspaceGraphRuntime` | `src/components/MyWork/canvas/workspaceGraphRuntime.ts` | graf reaktywny |
| Toolbar narzędzi | `IdeaWorkspaceToolbar` | `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | aktywne narzędzie (mindmap/whiteboard/process_flow/table) |
| Panel AI | `IdeaAISuggestionsPanel` | `src/components/MyWork/IdeaAISuggestionsPanel.tsx` | propozycje węzłów |
| Panel kontekstu | `IdeaContextPanel` | `src/components/MyWork/IdeaContextPanel.tsx` | backlinki, notatki (UWAGA: tylko `useState` — efemeryczne) |
| Galeria szablonów | `IdeaTemplateGallery` | `src/components/MyWork/IdeaTemplateGallery.tsx` | ~80+ definicji szablonów |
| Eksport | `IdeaExportMenu` | `src/components/MyWork/IdeaExportMenu.tsx` | format, pendingExport |
| Ujednolicone wyszukiwanie | `IdeaUnifiedSearch` | `src/components/MyWork/IdeaUnifiedSearch.tsx` | query, matchedNodeIds |
| Ulubione | `useFavoriteIdeas` | `src/components/MyWork/hooks/useFavoriteIdeas.ts` | `favoriteIds[]` (localStorage + server) |
| Recents | `useRecentIdeas` | `src/components/MyWork/hooks/useRecentIdeas.ts` | `recentIds[]` (localStorage) |
| Snapshoty | `SnapshotHistory` | `src/components/MyWork/mindmap/SnapshotHistory.tsx` | lista migawek |
| Menu konwersji | `ConvertToOutputMenu` | `src/components/MyWork/ConvertToOutputMenu.tsx` | target, sourceIdeaId |

### Zasada weryfikacji E2E (obowiązkowa)

Każda akcja (create/update/delete/sync/convert) MUSI być potwierdzona w zakładce **Network** (DevTools):
- poprawny endpoint (pełna ścieżka `/api/my-work/...`),
- payload z oczekiwanymi polami,
- odpowiedź HTTP z kodem 200/201 (nie 4xx/5xx).

Po każdej operacji: **odśwież stronę → sprawdź, czy zmiana przetrwała** (nie był to tylko optimistic update). Dla operacji DB: sprawdź kolumnę w tabeli.

Sam wygląd komponentu bez żądania = **FAIL**.

### Flagi gating (do sprawdzenia przed testami)

| Flaga | Typ | Wartość | Efekt |
|---|---|---|---|
| `MYWORK_IDEAS` w `betaAccess.ts:58` | FE beta | `'open'` (w repo) | Ideas dostępne; weryfikuj przy każdym uruchomieniu — może być `'closed'` na prod |
| `isBetaLockedForRole(role)` | FE | false dla owner/admin | Gating nawigacyjny; API bez sprawdzania flagi (P3) |
| `BETA_ADMINS_EXEMPT` | FE | `false` | Admini też zamknięci gdy `'closed'`; zweryfikuj że nie ma wyjątków |
| `RADAR_ENABLED` | kompilacyjny | `false` | Radar/Home zakładki ukryte; nie dotyczy Ideas |

### Role do testów

| Rola | Do czego potrzebna |
|---|---|
| **owner** (DBR77) | pełny dostęp, główna persona testowa |
| **member** | test izolacji per-user (czy widzi tylko swoje idee) |
| **viewer / guest** | test braku możliwości zapisu |

---

## §setup — Środowisko testowe

### Uruchomienie

1. Dev server: `npm run dev` → http://localhost:3000 (FE) + http://localhost:3001 (BE).
2. Zaloguj się jako **owner DBR77** (pełne uprawnienia).
3. Sprawdź `betaAccess.ts:58` — jeśli `MYWORK_IDEAS: 'closed'`, przełącz tymczasowo na `'open'` albo wejdź bezpośrednio na `/my-work/ideas` (API działa bez flagi).
4. Otwórz **DevTools → Network** (filtr: `/api/my-work/my-ideas`, `/api/my-work/my-idea-folders`, `/api/my-work/my-ideas/`). Włącz **Preserve log**.
5. Otwórz **DevTools → Console** — zero błędów/warningów to wymóg przy każdym teście.

### Dane testowe (przygotuj przed testem)

| Zasób | Wartość |
|---|---|
| Pomysł 1 | tytuł: `TEST-IDEA-ALFA`, tagi: `test, alfa`, stage: spark |
| Pomysł 2 | tytuł: `TEST-IDEA-BETA`, bez tagów, stage: shaping |
| Pomysł 3 | tytuł: `TEST-IDEA-GAMMA`, folderId: null, stage: ready |
| Folder | nazwa: `TEST-FOLDER-01` |
| Tytuł długi (200 znaków) | `TYTUL-MAX-${50 znaków}` |
| Obraz PNG | plik < 1 MB (do uploadu do węzła) |
| Drugie konto | user z rolą **member** w tej samej organizacji |

---

## §1 — Beta-gating i dostęp [FLAG]

### §1.1 — Gating nawigacyjny (FE)

**Happy path (open):**
1. Zaloguj jako owner → wejdź na `/my-work` → kliknij zakładkę „Pomysły".
2. **Oczekiwane:** karta Ideas widoczna, brak beta-plate, URL zmienia się na `/my-work/ideas`.
3. **Asercja:** brak komunikatu blokady; komponent `MyIdeasListContent` renderuje się.

**Negatywny (closed) [FLAG]:**
1. W `src/utils/betaAccess.ts:58` ustaw `MYWORK_IDEAS: 'closed'` → przebuduj.
2. Zaloguj jako owner → kliknij zakładkę „Pomysły".
3. **Oczekiwane:** Beta plate widoczny zamiast listy; link do żądania dostępu; brak możliwości interakcji z listą.
4. Zaloguj jako admin → powtórz test.
5. **Oczekiwane:** admin RÓWNIEŻ zablokowany (`BETA_ADMINS_EXEMPT = false` — `MyWorkHub.tsx:609`). [FLAG]
6. Przywróć `'open'`.

**API bez flagi [FLAG]:**
1. Przy `MYWORK_IDEAS: 'closed'` (FE zamknięte) wywołaj bezpośrednio `GET /api/my-work/my-ideas` (np. przez curl lub DevTools → Fetch/XHR).
2. **Oczekiwane:** API zwraca `200 OK` z danymi (brak serwera sprawdzającego betę — znana P3). [DB] Odnotuj w raporcie.

### §1.2 — Izolacja per-user [DB]

1. Zaloguj jako owner → utwórz 2 idee.
2. Wyloguj → zaloguj jako member tej samej organizacji.
3. Wejdź na `/my-work/ideas`.
4. **Oczekiwane:** lista pusta lub tylko WŁASNE idee membera — idee ownera NIEWIDOCZNE.
5. [DB] Sprawdź: `SELECT * FROM my_ideas WHERE user_id != '<ownerId>' AND organization_id = '<orgId>'` — zero wierszy dla membera.

### §1.3 — Cross-org IDOR [DB]

1. Zaloguj jako owner org A → pobierz `ideaId` jednej idei.
2. Wyloguj → zaloguj jako user z org B → wywołaj `GET /api/my-work/my-ideas/<ideaId>`.
3. **Oczekiwane:** `404` lub `403` — NIGDY dane z innej org.

---

## §2 — Lista idei (`MyIdeasListContent`) — CRUD i widoki

### §2.1 — Tworzenie idei [DB]

**Happy path:**
1. Na liście idei kliknij przycisk „Nowa idea" (lub naciśnij klawisz `c`).
2. Podaj tytuł: `TEST-IDEA-ALFA`, dodaj tagi `test`, `alfa`, wybierz kolor.
3. Zatwierdź.
4. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas` → `201` z `{ id, title: 'TEST-IDEA-ALFA', ... }`.
   - Lista odświeża się → nowa karta/wiersz widoczny natychmiast (lub po re-fetchu).
   - [DB] `SELECT id, title, tags FROM my_ideas WHERE title = 'TEST-IDEA-ALFA'` → 1 wiersz.

**Negatywny (brak tytułu):**
1. Kliknij „Nowa idea" → pozostaw tytuł pusty → zatwierdź.
2. **Oczekiwane:** walidacja blokuje zapis; brak żądania do API; komunikat błędu.

**Negatywny (tytuł > limit):**
1. Spróbuj zapisać ideę z tytułem 201+ znaków.
2. **Oczekiwane:** pole obcięte do max LUB błąd walidacji; sprawdź limit w kodzie (`myIdeasTypes.ts`).

**Graniczny (tytuł = 1 znak):**
1. Utwórz ideę z tytułem jednej litery.
2. **Oczekiwane:** sukces (jeśli serwer akceptuje) lub walidacja (jeśli min=3). Odnotuj rzeczywiste zachowanie.

### §2.2 — Edycja idei [DB]

1. Kliknij wiersz/kartę idei → otwiera podgląd lub workspace.
2. Zmień tytuł na `TEST-IDEA-ALFA-ZMIANA`, dodaj tag `zmiana`.
3. Zapisz.
4. **Oczekiwane:**
   - Network: `PUT /api/my-work/my-ideas/<id>` → `200` z nowym tytułem.
   - [DB] `SELECT title, tags FROM my_ideas WHERE id = '<id>'` → `TEST-IDEA-ALFA-ZMIANA`, tags zawierają `zmiana`.
5. Odśwież stronę → edycja trwała.

### §2.3 — Usuwanie idei [DB]

1. Zaznacz `TEST-IDEA-BETA` → użyj Menu 2 (per-wiersz) → „Usuń".
2. Pojawi się dialog potwierdzenia.
3. Potwierdź usunięcie.
4. **Oczekiwane:**
   - Network: `DELETE /api/my-work/my-ideas/<id>` → `200`.
   - Idea znika z listy.
   - [DB] `SELECT * FROM my_ideas WHERE id = '<id>'` → 0 wierszy (soft delete lub fizyczne — odnotuj typ).
5. Odśwież → idea nadal zniknięta.

**Negatywny (anulowanie):**
1. Kliknij „Usuń" → w dialogu kliknij „Anuluj".
2. **Oczekiwane:** brak żądania DELETE; idea nadal na liście.

**Negatywny (błąd sieci):**
1. Usuń ideę podczas symulowanego błędu sieci (DevTools → Network → Offline).
2. **Oczekiwane:** toast z błędem; idea pozostaje na liście; brak uszkodzenia stanu.

### §2.4 — Trzy widoki listy [MANUAL]

**Widok tabeli (domyślny, skrót `c`→create, `e`→edit, `p`→convert):**
1. Na liście naciśnij `c` (poza polem input).
2. **Oczekiwane:** otwiera modal tworzenia nowej idei.
3. Zaznacz ideę → naciśnij `e`.
4. **Oczekiwane:** otwiera widok edycji/workspace tej idei.
5. Zaznacz ideę → naciśnij `p`.
6. **Oczekiwane:** otwiera `ConvertToOutputMenu`.

**Przełączenie widoków:**
1. Kliknij przełącznik widoków (toolbar lub skrót) → wybierz **grid**.
2. **Oczekiwane:** lista renderuje karty gridowe; `viewMode = 'grid'`; brak przeładowania strony.
3. Przełącz na **garden** (widok tagowy).
4. **Oczekiwane:** idee pogrupowane po tagach; możliwość zwijania grupy (klik na tag); skrót `c`/`e`/`p` nadal działa.
5. Odśwież → sprawdź, czy ostatni widok jest zapamiętany (persistowany widok).

**Pusta lista:**
1. Usuń wszystkie idee lub filtruj do 0 wyników.
2. **Oczekiwane:** empty-state branded z CTA „Stwórz pierwszą ideę" lub podobny komunikat; brak `TypeError` w konsoli.

### §2.5 — Sortowanie i filtry

1. Kliknij nagłówek kolumny „Tytuł" (widok tabeli).
2. **Oczekiwane:** lista sortuje się rosnąco; kolejny klik = malejąco; `sortField='title'`, `sortDir='asc'/'desc'` zmienione.
3. Odśwież → ostatni sort zapamiętany (persistowany w localStorage/sessionStorage).
4. Przetestuj sortowanie po: **stage**, **tool** (aktywne narzędzie), **dacie** (domyślne desc).

**Filtr po tagu:**
1. Kliknij tag `test` (w widoku garden lub filtrach Menu 3).
2. **Oczekiwane:** lista ograniczona do idei z tagiem `test`; licznik widoczny; inne idee schowane.
3. Wyczyść filtr → lista pełna.

**Filtr po ulubione (starred):**
1. Kliknij gwiazdkę (`aria-pressed`) przy `TEST-IDEA-ALFA`.
2. Kliknij przełącznik „Ulubione" / filter starred.
3. **Oczekiwane:** widoczna tylko `TEST-IDEA-ALFA`.

**Wyszukiwanie (search query):**
1. Wpisz „ALFA" w pole wyszukiwania.
2. **Oczekiwane:** Network → `GET /api/my-work/my-ideas?q=ALFA&limit=200` → lista przefiltrowana.
3. Wyczyść → pełna lista; brak wiecznego loadera.

### §2.6 — Foldery [DB]

**Tworzenie folderu:**
1. Kliknij „Nowy folder" (lub `window.prompt` — zweryfikuj przepływ w `MyIdeasListContent.tsx:488`).
2. Podaj nazwę `TEST-FOLDER-01` → zatwierdź.
3. **Oczekiwane:**
   - Network: `POST /api/my-work/my-idea-folders` → `201` z `{ id, name: 'TEST-FOLDER-01' }`.
   - Folder widoczny w panelu bocznym folderów.
   - [DB] `SELECT * FROM my_idea_folders WHERE name = 'TEST-FOLDER-01'` → 1 wiersz.

**Przeniesienie idei do folderu:**
1. Prawy klik na `TEST-IDEA-ALFA` (Menu 2) → „Przenieś do folderu" → wybierz `TEST-FOLDER-01`.
2. **Oczekiwane:**
   - Network: `PUT /api/my-work/my-ideas/<id>` z `{ folderId: '<folderId>' }` → `200`.
   - Idea znika z „Wszystkie" jeśli folder jest aktywnym filtrem.
   - Toast „Przeniesiono" (PL) / „Moved" (EN).
   - [DB] `SELECT folder_id FROM my_ideas WHERE id = '<id>'` → `<folderId>`.

**Filtrowanie po folderze:**
1. Kliknij `TEST-FOLDER-01` w panelu folderów.
2. **Oczekiwane:** lista zawiera tylko idee z tym folderem.

**Usunięcie folderu:**
1. Menu per-folder → „Usuń".
2. **Oczekiwane:**
   - Network: `DELETE /api/my-work/my-idea-folders/<folderId>` → `200`.
   - Folder znika z panelu; idee z folderu wracają do „Wszystkie" (folderId=null).
   - [DB] `SELECT * FROM my_idea_folders WHERE id = '<folderId>'` → 0 wierszy.

**Degradacja przy 503 (brak migracji na staging/prod):**
1. Na środowisku bez migracji `20260602_my_ideas_folders_favorites_recents.sql` — wywołaj `GET /api/my-work/my-idea-folders`.
2. **Oczekiwane:** serwer zwraca `503 not_configured`; UI DEGRADUJE ŁAGODNIE — brak paska folderów, bez crasha; lista idei nadal widoczna. [FLAG]

### §2.7 — Ulubione i ostatnio otwierane [DB]

**Ulubione:**
1. Kliknij gwiazdkę (`aria-pressed`) przy `TEST-IDEA-ALFA`.
2. **Oczekiwane:**
   - Network: `PUT /api/my-work/my-ideas/<id>` z `{ isFavorite: true }` → `200`.
   - Ikonka gwiazdki aktywna; `aria-pressed="true"`.
   - [DB] `SELECT is_favorite FROM my_ideas WHERE id = '<id>'` → `1`.
3. Kliknij ponownie (toggle off).
4. **Oczekiwane:** Network: PUT z `{ isFavorite: false }` → `200`; gwiazdka nieaktywna; [DB] `is_favorite = 0`.
5. Odśwież → stan ulubionych zachowany (cross-device, z serwera).

**Ostatnio otwierane (recents rail):**
1. Otwórz `TEST-IDEA-ALFA` (kliknij → workspace).
2. Wróć na listę.
3. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/opened` → `200`.
   - Idea pojawia się w pasie „Ostatnio otwarte" (`data-testid="ideas-recents-rail"`).
   - [DB] `SELECT last_opened_at FROM my_ideas WHERE id = '<id>'` → timestamp aktualizowany.
4. Odśwież → rail nadal zawiera element (localStorage + seed z serwera).

---

## §3 — Workspace mapy (`IdeaMapWorkspace`)

### §3.1 — Otwieranie workspace i hydratacja [DB]

1. Kliknij `TEST-IDEA-ALFA` → workspace otwiera się.
2. **Oczekiwane:**
   - Network: `GET /api/my-work/my-ideas/<id>/map` → `200` z `{ nodes, edges, version, preferred_tool }`.
   - Narzędzie `preferred_tool` (np. `mindmap`) jest aktywne od razu.
   - URL zmienia się na `/my-work/ideas/<id>/workspace/mindmap`.
   - Status-pill pokazuje „Zapisano" / „Saved" po zakończeniu hydratacji.
3. Zmień narzędzie na `table` → wróć na listę → otwórz ponownie.
4. **Oczekiwane:** `preferred_tool` = `table` (zapamiętane w DB).
   [DB] `SELECT preferred_tool FROM my_idea_maps WHERE idea_id = '<id>'`.

### §3.2 — Status autosave i stany sync

1. W workspace dodaj węzeł (mindmap lub whiteboard).
2. **Oczekiwane:** status-pill zmienia się na „Zapisywanie…" / „Saving…" po ~800 ms (debounce).
3. Po zapisie: status-pill → „Zapisano" / „Saved".
4. **Stany do przetestowania:**
   | Stan | Warunek | Oczekiwany komunikat |
   |---|---|---|
   | `idle` | brak zmian | brak lub „Zapisano" |
   | `queued` | zmiana w buforze | ikona oczekiwania |
   | `saving` | żądanie w locie | „Zapisywanie…" |
   | `saved` | 200 OK | „Zapisano" / „Saved" |
   | `offline` | brak sieci | „Offline — zmiany lokalnie" |
   | `conflict` | 409 | „Konflikt zmian" / „Change conflict" |
5. Symuluj offline (DevTools → Network → Offline) → edytuj węzeł → przywróć online.
6. **Oczekiwane:** po przywróceniu sieci flush następuje automatycznie (event `online`); status → „Saved".

### §3.3 — Konflikt 409 (optimistic concurrency) [MANUAL][DB]

> **KRYTYCZNY TEST — P0 po naprawie commit `0b81310448`**

1. Otwórz tę samą ideę w **dwóch kartach** przeglądarki (tab A i tab B).
2. W tab A: dodaj węzeł „Węzeł-A" → poczekaj na flush (status „Saved").
3. W tab B (bez reload — wersja niezsynchronizowana): dodaj węzeł „Węzeł-B" → poczekaj na flush.
4. **Oczekiwane (poprawne zachowanie po naprawie):**
   - Network tab B: `POST /api/my-work/my-ideas/<id>/map/sync` → `409 Conflict`.
   - Banner lub toast: „Mapa zmieniona w innej karcie — odświeżono z serwera" / „Map changed elsewhere".
   - Graf w tab B jest rehydrowany z serwera (`conflictRefreshRef.current?.()`, `IdeaMapWorkspace.tsx:459`) — zawiera Węzeł-A.
   - Węzeł-B MOŻE być utracony (last-write-wins) — odnotuj zachowanie, ale KLUCZOWE że nie ma cichego nadpisania bez komunikatu.
5. [DB] `SELECT version FROM my_idea_maps WHERE idea_id = '<id>'` → wersja wyższa niż przed.
6. **Weryfikacja naprawy kontra poprzednie zachowanie:** jeśli toast pojawia się BEZ rehydracji grafu — to REGRESJA (P0); zapisz jako FAIL z plikiem:linią.

**Edge — empty-reset guard:**
1. Wymuś `POST /api/my-work/my-ideas/<id>/map/sync` z pustym grafem (`nodes: [], edges: []`).
2. **Oczekiwane:** serwer zwraca `400 IDEA_MAP_EMPTY_RESET_BLOCKED` (`my-work.routes.ts:3977-4005`) — brak nadpisania pełnego grafu pustym.

### §3.4 — Flush przy zdarzeniach [MANUAL]

1. Otwórz workspace → dodaj węzeł → **przed upływem 800ms debounce**:
   - Test A: wciśnij `Cmd+S`.
   - Test B: przełącz zakładkę przeglądarki (event `visibilitychange`).
   - Test C: kliknij link powodujący nawigację (event `beforeunload`).
2. **Oczekiwane każdy test:**
   - Network: żądanie sync wysyłane natychmiast (flush wymuszony).
   - Status-pill → „Saved".
3. **Znana luka L-04 [FLAG]:** przełączenie narzędzia workspace (np. mindmap → table) NIE wysyła flusha. Zmiany z ostatnich <800ms mogą przepaść. Odnotuj w raporcie jako otwartą lukę.

### §3.5 — Przełącznik 4 narzędzi (`IdeaWorkspaceToolbar`) [MANUAL]

**Narzędzia:** `mindmap` | `whiteboard` | `process_flow` | `table` (skróty klawiszowe 1–4).

1. W workspace naciśnij `1` → aktywuje `mindmap`.
2. Naciśnij `2` → aktywuje `whiteboard`.
3. Naciśnij `3` → aktywuje `process_flow`.
4. Naciśnij `4` → aktywuje `table`.
5. **Oczekiwane dla każdego przełączenia:**
   - URL aktualizuje się: `/my-work/ideas/<id>/workspace/<tool>`.
   - Toolbar `IdeaWorkspaceToolbar` wyświetla aktywne narzędzie.
   - Wskaźnik „ma zawartość" (kropka) widoczny jeśli inne narzędzie ma węzły.
   - Każde narzędzie w osobnym error boundary — błąd w jednym nie unosi workspace.
   - `preferred_tool` aktualizuje się w DB po przełączeniu. [DB]
6. **Znana luka L-03 [FLAG]:** `process_flow`, `whiteboard` i `table` tworzą osobną instancję `useIdeaMapSync` z własnym licznikiem wersji — może powodować samowywołane 409 przy szybkim przełączaniu. Odnotuj w raporcie, nie traktuj jako bug nowego kodu.

### §3.6 — Szablony (`IdeaTemplateGallery`) [MANUAL][DB]

**Happy path na pustym grafie:**
1. W workspace otwórz galerię szablonów (toolbar → ikona szablonu lub Cmd+K → „szablon").
2. Wybierz dowolny szablon z ~80+ dostępnych.
3. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/map/sync` z `baseVersion` i `nodes` szablonu → `200`.
   - Graf wypełniony węzłami szablonu.
   - Status-pill → „Saved".
   - [DB] `SELECT json_extract(extensions_json, '$.mindmap') IS NOT NULL FROM my_idea_maps WHERE idea_id = '<id>'` → 1.

**Znana luka P2 — brak confirm na niepustym grafie [FLAG]:**
1. Stwórz węzeł „Ręczny-01" → poczekaj na zapis.
2. Otwórz galerię → zastosuj szablon.
3. **Oczekiwane (idealne):** dialog potwierdzenia „Zastosowanie szablonu nadpisze istniejący graf. Kontynuować?".
4. **Faktyczne (znana luka `IdeaTemplateGallery.tsx:1886`):** szablon aplikuje się BEZ potwierdzenia — graf nadpisany. Odnotuj jako FAIL (P2, luka L-06).

---

## §4 — AI w workspace

### §4.1 — AI Suggestions Panel (`IdeaAISuggestionsPanel`) [DB]

1. W workspace otwórz panel AI (klik ikonki AI w prawym pasku lub Cmd+K → „sugestie").
2. **Oczekiwane:** panel `IdeaAISuggestionsPanel` otwiera się; aktywny panel = `'ai_suggestions'`.
3. Kliknij „Generuj sugestie".
4. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/map/ai-suggestions` z `{ nodes, language }` → `200` z tablicą propozycji.
   - Sugestie węzłów pojawiają się w panelu (nie skeleton).
   - Odpowiedź pochodzi z **realnego LLM** (`llmService.call`) — nie jest mockiem (sprawdź latencję: >1s = real, <100ms = mock).
5. Kliknij „Akceptuj" na jednej sugestii.
6. **Oczekiwane:** węzeł dodawany do grafu; `aiProposalRuntime.ts` aplikuje patch deterministycznie; żądanie sync wysyłane.
7. Kliknij „Odrzuć" na innej.
8. **Oczekiwane:** węzeł NIE dodany; brak żądania sync tylko dla odrzuconych.

### §4.2 — AI Expand (rozwijanie gałęzi) [DB]

1. Zaznacz węzeł w mindmap → użyj akcji „Rozwiń z AI" (`mm_ai_expand_branch`).
2. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/map/expand` z `{ nodeId, context }` → `200` z nowymi węzłami.
   - Nowe węzły pojawiają się jako dzieci wybranego węzła.
   - Realizowany przez `IdeaProposalReview` z możliwością akceptacji/odrzucenia propozycji.

### §4.3 — Gap Analysis [DB]

1. W workspace → Cmd+K lub menu → „Analiza luk".
2. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/map/gap-analysis` → `200`.
   - Wynik gap analysis pojawia się w panelu AI lub jako osobna sekcja.
   - Sugestia „brakujących obszarów" wygenerowana przez LLM.

### §4.4 — AI Generate (generowanie pełnego grafu) [DB]

1. Na nowej, pustej idei → otwórz workspace → kliknij „Wygeneruj mapę z AI".
2. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/ai-generate` z `{ seed_text, language }` → `200` z propozycją grafu.
   - `IdeaProposalReview` wyświetla podgląd propozycji.
   - Użytkownik może zaakceptować lub odrzucić per węzeł.
3. Zaakceptuj wszystkie → sync.
4. **Oczekiwane:** Network: `POST .../map/sync` → `200`; graf zapisany.

---

## §5 — Snapshoty / historia wersji (`SnapshotHistory`) [DB][FLAG]

> **UWAGA KRYTYCZNA:** Tabela `my_idea_map_snapshots` może nie istnieć na produkcji/stagingu. Endpointy zwracają `503` przez `requireTables`. Testy §5 wykonaj TYLKO na lokalnym dev z działającą migracją `20260611_my_idea_map_snapshots_and_activity.sql`.

### §5.1 — Tworzenie snapshotu [DB]

1. Otwórz workspace z kilkoma węzłami.
2. Kliknij „Zapisz migawkę" / „Save snapshot" (w `SnapshotHistory` lub menu workspace).
3. Podaj etykietę: `SNAPSHOT-01`.
4. **Oczekiwane (dev lokalny z migracją):**
   - Network: `POST /api/my-work/my-ideas/<id>/map/snapshots` → `201` z `{ id, label: 'SNAPSHOT-01', nodeCount, edgeCount }`.
   - Toast „Migawka zapisana".
   - [DB] `SELECT * FROM my_idea_map_snapshots WHERE idea_id = '<id>'` → 1 wiersz.

**Oczekiwane (staging/prod bez migracji) [FLAG]:**
   - Network: `POST .../snapshots` → `503 not_configured`.
   - UI: komunikat błędu widoczny (NIE cicha pustka — luka L-02). Odnotuj rzeczywiste zachowanie.

### §5.2 — Lista snapshotów [DB]

1. `GET /api/my-work/my-ideas/<id>/map/snapshots` → `200` z tablicą migawek.
2. **Oczekiwane:** `SnapshotHistory` wyświetla listę; każda pozycja zawiera etykietę, timestamp, `node_count`.

### §5.3 — Usunięcie snapshotu [DB]

1. Kliknij „Usuń" przy `SNAPSHOT-01`.
2. **Oczekiwane:**
   - Network: `DELETE /api/my-work/my-ideas/<id>/map/snapshots/<snapshotId>` → `200`.
   - [DB] Wiersz usunięty z `my_idea_map_snapshots`.

---

## §6 — Komentarze do węzłów (`idea_node_comments`) [DB]

### §6.1 — Dodanie komentarza

1. W workspace kliknij prawym przyciskiem na węzeł → „Dodaj komentarz".
2. Wpisz tekst: `KOMENTARZ-TESTOWY`.
3. Wyślij.
4. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/map/nodes/<nodeId>/comments` z `{ text: 'KOMENTARZ-TESTOWY' }` → `201`.
   - Komentarz widoczny przy węźle (ikona lub drawer).
   - [DB] `SELECT text FROM idea_node_comments WHERE idea_id = '<id>' AND node_id = '<nodeId>'` → `KOMENTARZ-TESTOWY`.

### §6.2 — Lista komentarzy

1. `GET /api/my-work/my-ideas/<id>/map/nodes/<nodeId>/comments` → `200` z tablicą.
2. Komentarz zawiera: `id`, `text`, `user_name`, `created_at`.

### §6.3 — Usunięcie komentarza [DB]

1. Kliknij „Usuń" przy komentarzu (własnym).
2. **Oczekiwane:**
   - Network: `DELETE .../comments/<commentId>` → `200`.
   - [DB] Wiersz usunięty z `idea_node_comments`.

**Negatywny — usunięcie cudzego komentarza:**
1. Spróbuj usunąć komentarz innego usera.
2. **Oczekiwane:** `403` lub brak przycisku „Usuń" dla cudzych komentarzy.

---

## §7 — Aktywność (`my_idea_activity`) [DB]

### §7.1 — Feed aktywności

1. Otwórz workspace → kliknij ikonę „Aktywność" (lub panel boczny).
2. **Oczekiwane:** Network: `GET /api/my-work/my-ideas/<id>/activity` → `200` z tablicą zdarzeń.
3. Lista zawiera zdarzenia z `type`, `actor`, `node_label`, `created_at`.

### §7.2 — Zapis zdarzenia [DB]

1. Każda ważna akcja (dodanie węzła, konwersja, zmiana stage) powinna automatycznie tworzyć wpis.
2. **Oczekiwane:** Network: `POST /api/my-work/my-ideas/<id>/activity` z `{ type, actor, detail }` → `201`.
3. [DB] `SELECT * FROM my_idea_activity WHERE idea_id = '<id>' ORDER BY created_at DESC LIMIT 5` → wpisy odpowiadające akcjom.

---

## §8 — Eksport (`IdeaExportMenu`) [MANUAL]

### §8.1 — Eksport klientowy (PNG/SVG/PDF/Markdown/JSON)

1. W workspace otwórz `IdeaExportMenu` (przycisk eksportu w toolbarze).
2. Wybierz kolejno każdy format:
   - **PNG:** `IdeaExportMenu.tsx:222+` — html-to-image → pobieranie pliku `*.png`.
   - **SVG:** pobieranie `*.svg`.
   - **PDF:** html-to-image → jsPDF → `*.pdf` (UWAGA: to screenshot rastrowy, nie wektorowy — odnotuj).
   - **Markdown:** `ideaMapToMarkdown.ts` → pobieranie `*.md`.
   - **JSON:** pobieranie struktury grafu jako `*.json`.
3. **Oczekiwane dla każdego:**
   - Plik pobiera się poprawnie; brak błędu 4xx w Network.
   - Zawartość pliku odpowiada stanowi grafu.

### §8.2 — Eksport CSV tabeli [DB]

1. Przełącz na narzędzie `table` → kliknij eksport CSV.
2. **Oczekiwane:**
   - Network: `GET /api/my-work/my-ideas/<id>/export-csv` → `200` z `Content-Type: text/csv`.
   - Plik CSV zawiera wiersze odpowiadające węzłom/wierszom tabeli.

### §8.3 — Eksport serwerowy (znana luka L-05) [FLAG][DB]

1. Kliknij przycisk eksportu „raportu" / „decku" (jeśli widoczny bez flagi „wkrótce").
2. **Oczekiwane (znane zachowanie STUB):**
   - Network: `POST /api/v4-final/ideas/<id>/export` → `200/201` z `{ status: 'pending' }`.
   - [DB] `SELECT status FROM idea_exports WHERE idea_id = '<id>'` → `'pending'` (NIE `'done'`); plik NIGDY nie powstaje.
   - UX: komunikat „Przygotowuję eksport…" bez postępu / spinner bez końca. Odnotuj jako FAIL (D-01).
3. Jeśli przycisk jest ukryty za etykietą „Wkrótce" / flagą → odnotuj jako PASS (zgodnie z decyzją DP-5).

---

## §9 — Konwersja idea → output (`POST /api/my-work/my-ideas/:id/convert`) [DB]

> **KRYTYCZNY test — 6 ścieżek konwersji z traceability**

### §9.1 — Konwersja → Inicjatywa [DB]

1. Na liście zaznacz `TEST-IDEA-ALFA` → Menu 2 lub `p` → wybierz cel `initiative`.
2. Ewentualne zaznaczenie węzłów w workspace (nodeIds dla wzbogacenia).
3. Potwierdź konwersję.
4. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/<id>/convert` z `{ target: 'initiative', nodeIds?: [...] }` → `200` z `{ initiativeId }`.
   - Toast „Inicjatywa utworzona" / „Initiative created".
   - [DB] `SELECT id, title FROM initiatives WHERE id = '<initiativeId>'` → 1 wiersz.
   - [DB] `SELECT * FROM link_graph_edges WHERE source_id = '<ideaId>' AND target_id = '<initiativeId>'` → krawędź link-graph.
   - [DB] `SELECT stage FROM my_ideas WHERE id = '<ideaId>'` → `'promoted'`.
5. Kliknij w toast lub nawiguj do inicjatyw → `TEST-IDEA-ALFA` powinna być widoczna jako inicjatywa.

### §9.2 — Konwersja → Task Set [DB]

1. Zaznacz `TEST-IDEA-BETA` → cel `task_set`.
2. **Oczekiwane:**
   - Network: `POST .../convert` z `{ target: 'task_set' }` → `200` z `{ taskIds }`.
   - [DB] `SELECT COUNT(*) FROM tasks WHERE source_idea_id = '<ideaId>' OR title LIKE 'TEST-IDEA-BETA%'` → ≥1.
   - [DB] Link-graph krawędź idea→task_set.

### §9.3 — Konwersja → Decision [DB]

1. Cel: `decision`.
2. **Oczekiwane:** Network → `200`; [DB] wpis w `decisions`; link-graph.

### §9.4 — Konwersja → Report [DB]

1. Cel: `report`.
2. **Oczekiwane:** Network → `200`; delegacja do report-builder (`conversionService.ts`); [DB] wpis w tabeli raportów + link-graph.

### §9.5 — Konwersja → Presentation [DB]

1. Cel: `presentation`.
2. **Oczekiwane:** Network → `200`; delegacja do presentations; link-graph.

### §9.6 — Konwersja → Team Chat [DB]

1. Cel: `team_chat`.
2. **Oczekiwane:** Network → `200`; CREATE chat session; link-graph.

### §9.7 — Negatywne ścieżki konwersji

1. Spróbuj skonwertować ideę cudzego usera (inny userId).
2. **Oczekiwane:** `403` — guard `WHERE id=? AND user_id=? AND organization_id=?` (`my-work.routes.ts:5929`).
3. Symuluj błąd serwera przy konwersji (np. Offline) → **Oczekiwane:** toast błędu; idea nie zmienia stage; brak orphaned records.

---

## §10 — Unified Search w workspace (`IdeaUnifiedSearch`) [MANUAL]

### §10.1 — Wyszukiwanie po treści

1. W workspace naciśnij `Cmd+F`.
2. **Oczekiwane:** `IdeaUnifiedSearch` otwiera się z autofocusem na polu query.
3. Wpisz tekst pasujący do etykiety węzła.
4. **Oczekiwane:** węzły pasujące do query są podświetlone / wyróżnione w grafie; licznik `n wyników`.
5. Użyj Enter / strzałek do nawigowania między trafieniami.
6. Esc → wyszukiwarka zamykana; zaznaczenie węzłów czyści się.

### §10.2 — Wyszukiwanie po tagach / ownerach / komentarzach

1. Wpisz tag (`test`) → czy węzły z tym tagiem są znajdowane?
2. Wpisz fragment nazwy ownera → czy węzły ownera są wyróżnione?
3. **Oczekiwane:** wyszukiwarka przeszukuje labele / opisy / ownerów / tagi / komentarze węzłów.

---

## §11 — Ścieżki CROSS-MODULE

### §11.1 — Czat Teresa → Ideas (create from chat) [DB]

1. Otwórz Czat Teresa (`/chat`).
2. Wyślij wiadomość: „Mam pomysł: zbudujmy asystenta onboardingowego".
3. Użyj opcji „Zapisz jako pomysł" / „Save as idea" (jeśli dostępna w payloadzie lub menu czatu).
4. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas/from-chat` z `{ sourceConversationId, title, seed_text }` → `201`.
   - Toast potwierdzenia.
   - [DB] `SELECT * FROM my_ideas WHERE seed_text LIKE '%asystenta onboardingowego%'` → 1 wiersz.
5. Przejdź do `/my-work/ideas` → nowa idea widoczna na liście.

### §11.2 — Notatnik → Ideas (save-as-idea) [DB]

1. Otwórz Notatnik (`/my-work/notebook`).
2. W edytorze wpisz kilka zdań → w SlashMenu wpisz `/save-as-idea`.
3. Potwierdź tytuł.
4. **Oczekiwane:**
   - Network: `POST /api/my-work/my-ideas` z treścią ze strony notatnika → `201`.
   - [DB] `SELECT * FROM my_ideas WHERE title = '<wybrany tytuł>'` → 1 wiersz.
5. Przejdź do Ideas → nowa idea widoczna.

### §11.3 — Ideas → Inicjatywy (konwersja) [DB]

(Patrz §9.1 — konwersja → initiative.)
Dodatkowy krok cross-module:
1. Po konwersji przejdź do `/initiatives`.
2. **Oczekiwane:** nowa inicjatywa widoczna w liście inicjatyw z tytułem z idei.
3. Wróć do Ideas → link do inicjatywy widoczny w `IdeaContextPanel` (backlinki link-graph).

### §11.4 — Ideas → Canvas (handoff) [MANUAL]

1. W workspace kliknij „Otwórz w Canvas" / „Expand to Canvas" (jeśli CTA istnieje).
2. **Oczekiwane:** nawigacja do `/chat` z otwartym panelem Canvas (split-view); treść idei wklejona do edytora TipTap lub wiadomości kompozera.
3. Treść czatu nie jest gubiona podczas przejścia (brak full page reload). [MANUAL]

### §11.5 — Ideas → Outputs (eksport deck/doc) [DB][FLAG]

1. W workspace kliknij „Utwórz prezentację" / konwersja → `presentation`.
2. **Oczekiwane:** (patrz §9.5) delegacja do Presentation Studio; link-graph krawędź.
3. Przejdź do `/presentations` → nowa prezentacja z treścią idei widoczna. [DB]

### §11.6 — Ideas → AI Chat (konwersja → team_chat) [DB]

1. Konwertuj ideę cel `team_chat` (§9.6).
2. **Oczekiwane:** czat sesja otwiera się z kontekstem idei; tytuł czatu zawiera tytuł idei.

---

## §12 — Presence (fasadowa współpraca) [FLAG][DB]

> **Uwaga architektoniczna:** Presence jest technicznie realizowana, ale mapa jest `per-user` (UNIQUE INDEX `ux_my_idea_maps_user_idea`). Drugi użytkownik NIE widzi tej samej treści. To fasada.

1. Otwórz ideę jako owner → workspace aktywny.
2. Sprawdź Network: cykliczne `GET /api/my-work/my-ideas/<id>/presence` lub `POST .../presence`.
3. **Oczekiwane:**
   - Presence broadcast: `POST /api/my-work/my-ideas/<id>/presence` z `{ cursor, userId, channelId: 'idea-table-<ideaId>' }` → `200`. [FLAG] Odnotuj że `channelId` NIE zawiera `orgId` (P2).
4. Zaloguj drugi user z innej org → wywołaj `POST /api/my-work/my-ideas/<ideaId>/presence` (znając ideaId).
5. **Oczekiwane:** serwer nie weryfikuje przynależności ideaId do org przy presence — **znana P2**. Odnotuj, nie traktuj jako nowy bug.

---

## §13 — Przekrojowe

### §13.1 — Kombinacje stanów

1. Utwórz ideę z folderem + tagami + ulubionym + recent.
2. Wejdź w workspace → dodaj węzły → zmień preferred_tool → wróć do listy.
3. **Oczekiwane:** wszystkie stany zachowane po reload:
   - Folder przypisany (DB).
   - Gwiazdka aktywna.
   - Rail recents zawiera ideę.
   - Preferred_tool zapamiętany.

### §13.2 — Persistencja po pełnym przeładowaniu

1. Wykonaj 5 operacji (create, folder, favorite, sync grafu, komentarz).
2. Odśwież stronę twardym przeładowaniem (`Cmd+Shift+R`).
3. **Oczekiwane:** wszystko zachowane; brak phantom entries.

### §13.3 — Disabled podczas operacji async

1. Podczas aktywnego żądania sync (status = „Saving…") sprawdź:
   - Czy przycisk „Usuń ideę" jest zablokowany lub disabled?
   - Czy przycisk „Konwertuj" jest dostępny?
2. **Oczekiwane:** krytyczne akcje (delete, convert) powinny być zablokowane podczas zapisu w locie — zapobieganie race condition.

### §13.4 — Z-index / viewport (małe okno) [MANUAL]

1. Zmniejsz okno przeglądarki do 1024×600 px.
2. Sprawdź:
   - `IdeaWorkspaceToolbar` (pływający) nie wychodzi poza ekran.
   - Panel AI (prawy) nie zasłania toolbara ani pola edycji.
   - Menu eksportu nie wychodzi poza viewport.
   - Podgląd boczny (grid/garden) renderuje się czytelnie.

### §13.5 — i18n PL / EN [MANUAL]

1. Przełącz język na **PL** → sprawdź:
   - Tytuły paneli, etykiety przycisków, toasty, komunikaty błędów, empty-state.
   - Brak gołych string literałów (nie używa `isPolish ? '...' : '...'` inline bez klucza i18n — sprawdź wybrane miejsca w `MyIdeasListContent.tsx`).
   - `t('myWork.errors.fetchFailed', ...)` — czy klucz istnieje w plikach tłumaczeń.
2. Przełącz na **EN** → powtórz.
3. **Oczekiwane:** każdy widoczny string przetłumaczony; brak polskich fragmentów w EN i odwrotnie.

**Szczególne przypadki i18n:**
- Etykiety stage: `spark` / `incubating` / `shaping` / `ready` / `promoted` — czy mają tłumaczenie?
- AI sugestie — czy odpowiedź LLM jest w języku interfejsu? (sprawdź payload `language` w żądaniu).

### §13.6 — Dark mode [MANUAL]

1. Przełącz na dark mode.
2. Sprawdź w każdym widoku (lista tabela / grid / garden / workspace):
   - Czytelność tekstu (kontrast ≥ 4.5:1 dla normalnego tekstu).
   - Brak białych artefaktów (`canvasLocked=false` hardcode w `IdeaMapWorkspace.tsx:373` nie powinien wpływać na kolory).
   - Status-pill sync czytelny w ciemnym tle.
   - Panel AI / kontekstu z poprawnym tłem.

### §13.7 — A11y (dostępność) [MANUAL]

1. Sprawdź z klawiaturą (Tab, Shift+Tab, Enter, Esc, Space):
   - Lista idei: Tab przechodzi przez wiersze; Enter otwiera workspace; Esc zamyka podgląd.
   - Gwiazdka (`aria-pressed`): Space/Enter toggleje stan; `aria-label="Star"/"Unstar"`.
   - Dialog usunięcia: fokus trafia na przycisk „Potwierdź"; Esc zamyka.
   - Menu `ConvertToOutputMenu`: role="menu", role="menuitem"; Esc zamyka.
2. Sprawdź `data-testid="ideas-recents-rail"` istnieje — testy używają go do weryfikacji.
3. Sprawdź `aria-label` przy folderze: `aria-label="Usuń folder" / "Delete folder"`.

### §13.8 — Konsola — zero błędów

Przez całą sesję testową (wszystkie §1–§12) DevTools Console ma zawierać **zero błędów** i **zero warningów**.

**Znana delta:** `console.log` debug w `IdeaMapWorkspace.tsx:433, 719, 1172, 1809` — są to `console.log` (nie `console.error`), ale ich obecność odnotuj jako otwartą lukę L-06.

---

## §14 — Testy regresji / jednostkowe

Uruchom wszystkie istniejące testy Ideas przed sesją manualną:

```bash
# FE unit
npx vitest run \
  tests/unit/mywork/ideaMapToMarkdown.test.ts \
  tests/unit/mywork/useRecentIdeas.test.ts \
  tests/unit/mywork/useFavoriteIdeas.test.ts \
  tests/unit/mywork/ideaTablePresenceErrorMessage.test.ts \
  tests/unit/components/MyWork/ideaWorkspaceState.test.ts \
  tests/unit/backend/v4-smoke/r0-idea-schema.test.ts \
  tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts

# Komponenty
npx vitest run \
  tests/components/MyWork/ideaEntryTypes.test.ts \
  tests/components/MyWork/IdeaExportMenu.test.tsx \
  tests/components/MyWork/IdeaTableTool.honesty.test.tsx \
  tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx \
  tests/components/RouterSync.idea-artifact.test.tsx

# Smoke sync (FE canvas)
npx vitest run \
  src/components/MyWork/canvas/__tests__/ideaMapSyncPersistence.smoke.test.ts
```

**Oczekiwane:** wszystkie PASS (96+ testów); zero FAIL; zero SKIP nieoczekiwanych.

**Testy E2E Playwright (wymaga przeglądarki):**
```bash
npx playwright test tests/e2e/smoke/qa-idea-mindmap-checklist.spec.ts
```
> Uruchom na dev lokalnym; nie jest w tier0 CI (znana luka L-08).

**Luki testowe (do zgłoszenia, nie tworzenia w tej sesji):**
- `tests/integration/ideas/map-sync-conflict.test.ts` — BRAK (S3 nie ma testu BE)
- `tests/integration/ideas/map-sync-roundtrip.test.ts` — BRAK (S2)
- `tests/integration/ideas/convert-to-initiative.test.ts` — BRAK (S5)
- `tests/integration/ideas/snapshots.test.ts` — BRAK (S6)

---

## §MAPA EPIKÓW — pokrycie F-epików z teczki wdrożeniowej

| Epik (teczka M05 §F) | Sekcja testu | Status pokrycia |
|---|---|---|
| **EPIK 1** — Conflict bez cichego nadpisania (P0, L-01) | §3.3 | ✅ Pokryty — test wymuszenia 409 + weryfikacja rehydracji |
| **EPIK 2** — Persystencja snapshots/activity (P0, L-02) | §5, §7 | ✅ Pokryty — test 201 (lokalnie) + 503 UX (staging) |
| **EPIK 3** — Jeden runtime dla 4 narzędzi (P1, L-03/L-04) | §3.4, §3.5 | ✅ Pokryty — test flushów + przełącznik narzędzi |
| **EPIK 4** — Eksport serwerowy (D-01) | §8.3 | ✅ Pokryty — weryfikacja STUB vs flaga „wkrótce" |
| **EPIK 5** — Szlif UX (L-06) | §3.6 (szablon), §13.8 (console.log) | ✅ Pokryty |
| **EPIK 6** — Kanon wersjonowania (D-02) | §5 (snapshot vs versions) | ✅ Pokryty opisowo — decyzja D-02 nadal otwarta |
| **EPIK 7** — Testy (L-08) | §14 | ✅ Pokryty — uruchomienie istniejących + lista luk |

---

## §FORMAT RAPORTU + DoD

### Format raportu (dla każdego punktu testowego)

```
§<numer>.<podpunkt> — <krótka nazwa>
Kroki: [lista kroków wykonanych]
Oczekiwane: [co powinno się stać]
Faktyczne: [co faktycznie się stało]
Status: PASS / FAIL / BLOCKED / N/A
Dowód:
  - Screenshot: <nazwa_pliku.png>
  - Network: endpoint=<ścieżka> status=<kod> payload=<json fragment>
  - DB: <zapytanie SQL> → <wynik>
  - Console: 0 błędów / <lista błędów>
Uwagi: [np. znana luka, nr L-xx, plik:linia]
```

### Definition of Done (odhaczane)

- [ ] Wszystkie pozycje §1–§13 ze statusem PASS lub N/A (udokumentowane powody N/A)
- [ ] Każda operacja CUD potwierdzona w Network + DB
- [ ] Konflikt 409 → rehydracja potwierdzona (§3.3) — NIE cicha pustka
- [ ] Snapshoty: 201 na lokalnym dev LUB 503 z czytelnym komunikatem UX (§5)
- [ ] Konwersja → inicjatywa: link-graph krawędź w DB (§9.1)
- [ ] Ścieżki cross-module §11 zweryfikowane (czat→idea, notebook→idea, idea→initiative)
- [ ] Testy jednostkowe 96+ PASS, 0 FAIL (§14)
- [ ] Interfejs przetestowany w PL i EN (§13.5)
- [ ] Interfejs przetestowany w light i dark mode (§13.6)
- [ ] Konsola: 0 błędów przez całą sesję (§13.8)
- [ ] Luki otwarte (L-03, L-04, L-05/D-01, L-06, L-07/D-02, L-08) udokumentowane w raporcie z numerem i plikiem:linią
