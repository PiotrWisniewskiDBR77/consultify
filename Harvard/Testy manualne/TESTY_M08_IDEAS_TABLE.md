# TESTY — M08 Ideas · Table (narzędzie canvas)

> **Moduł:** M08 Ideas Table (`/my-work/ideas/workspace/table` — technicznie `/my-work?ideaId=<id>&tool=table`)
> **Zakres tej paczki:** pełny E2E dla narzędzia `IdeaTableTool` — tworzenie i persist tabeli, 25 typów kolumn, CRUD wierszy, sortowanie, filtrowanie, AI (NL command bar, ai-fill, Copilot, AI-Categorize), eksport (CSV, prezentacja), konwersja wierszy, szablony frameworków, skróty klawiaturowe, znany bug rename tabeli, zepsute przyciski.
> **Poza zakresem:** beta-zamknięte funkcje ścieżki B (flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST=false`) — wszelkie multi-tabele, FormBuilder, realtime presence, AuditTrail platformy; moduł M20 Tabele Studio (osobny moduł).
> **Cel:** agent piszący i testujący potwierdza każdą akcję Network-payloadem + stan DB lub reload-check. Sam wygląd UI to NIE dowód.
> **Wzór formatu:** `Harvard/Testy manualne/TESTY_M01_CZAT.md`.
> **Bazuje na:** karta audytu `Harvard/modules/M08-ideas-table/KARTA_AUDYTU.md`, teczka `Harvard/wdrozenie-100/M08-ideas-table.md`, inwentarz `Harvard/podzial/ideas/MODULE_02D_table.md`, `Harvard/podzial/ideas/_INDEX_IDEAS_SPLIT.md`.
> **Legenda:** **[MANUAL]** = wymaga ręcznej akcji fizycznej (drag, klaw, upload); **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód = wiersz/kolumna w bazie; **[KNOWN-BUG]** = znany bug — testujemy że *jest*, a nie że *naprawiony*; **[EPIK-N]** = ślad do epiku z teczki.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny

### Mapa komponent ↔ plik ↔ stan

| Komponent | Plik | Stan / zależność |
|---|---|---|
| Główny kontener | `src/components/MyWork/IdeaTableTool.tsx` (3692 l.) | orchestruje wszystko; `usePlatform` derived |
| Persystencja | `src/components/MyWork/table/useTablePersistence.ts` | hydratacja + map-sync; `extensions.table` blob |
| Sync + konflikt 409 | `src/components/MyWork/canvas/useIdeaMapSync.ts` | `baseVersion`, stany: idle/queued/saving/saved/offline/conflict |
| Wiersze + filtry | `src/components/MyWork/table/useTableRows.ts` | `processedRows`, sortowanie, filtrowanie (UWAGA: `between`/`in` NIE zaimplementowane) |
| Typy kolumn | `src/components/MyWork/table/tableTypes.ts` | 25 typów: `ColumnType`; `FilterOperator` (8 operatorów, 2 niedziałające) |
| Renderery komórek | `src/components/MyWork/table/CellRenderer.tsx` | per-typ renderer |
| Toolbar | `src/components/MyWork/table/TableToolbar.tsx` | tryby UI, CSV, konektory |
| AI — NL command bar | `src/components/MyWork/table/AITableAssistant.tsx` | `/my-ideas/:id/ai-table-action` |
| AI — fill komórek | `src/components/MyWork/table/InlineAIFill.tsx` | `/my-ideas/:id/ai-fill` |
| AI — Copilot | `src/components/MyWork/table/AICopilotMode.tsx` | `/my-ideas/:id/ai-suggestions` + **fałszywy streaming** |
| AI — kategoryzacja | `src/components/MyWork/table/AICategorizeTool.tsx` | LLM + ciche fallback przy błędzie |
| AI — scoring | `src/components/MyWork/table/IdeaScoringModel.tsx` | realne LLM |
| Formula | `src/components/MyWork/table/FormulaEngineV2.ts` | SUM/AVG/MIN/MAX/COUNT/IF/CONCAT/SCORE po krawędziach grafu |
| Eksport prezentacja | `src/components/MyWork/table/ExportToPresentation.tsx` | `POST /api/presentations/decks` |
| Eksport CSV (BE) | `GET /api/my-work/my-ideas/:id/export-csv` | `my_idea_maps.extensions_json` |
| Szablony | `src/components/MyWork/table/FrameworkGenerator.tsx` | hardcodowane definicje SWOT itp. |
| Klawiatura | `src/components/MyWork/table/useTableKeyboard.ts` | Tab/Enter/Arrows/Ctrl+Z |
| Relacje cross-table | `src/components/MyWork/table/CrossTableRelations.tsx` | `GET /api/my-work/my-ideas/:id/map` |
| ActivityFeed | `src/components/MyWork/table/ActivityFeed.tsx:150-152` | `Api.get('/table-platform/tables/:id/audit')` (z auth) → zależne od `requireTableAccess` + istnienia tabeli platformy |
| AuditTrailPanel | `src/components/MyWork/table/AuditTrailPanel.tsx:179-181` | `fetch('/api/table-platform/tables/:id/audit', { headers: getHeaders() })` (z auth) → mount istnieje (`requireTableAccess`); zależne od dostępu/istnienia tabeli |
| Rename tabeli (bug) | `IdeaTableTool.tsx:789-795` | tylko React-state, zero API → **znika po reload** |
| Undo/redo | `src/components/MyWork/table/useUndoRedo.ts` | 50 kroków |
| Wejście do workspace | `src/components/MyWork/IdeaMapWorkspace.tsx:2877` | mount narzędzia Table |
| Beta-gating | `src/utils/betaAccess.ts:32,58` + `MyWorkHub.tsx:609` | `MYWORK_IDEAS: 'open'`, `BETA_ADMINS_EXEMPT = true` → dostęp OTWARTY |

### Zasada E2E — obowiązkowa

Każda akcja zapisu/odczytu MUSI być potwierdzona:
1. **Network** — właściwy endpoint + kod HTTP + payload (nie tylko wygląd UI).
2. **Persist-check** — przeładuj stronę → dane muszą przetrwać (dotyczy wszystkich operacji zapisu).
3. **DB (opcjonalnie dla [DB])** — wiersz `my_idea_maps.extensions_json` w DB = faktyczne dane.

Wyjątek: akcje lokalnego UI bez persystencji (np. zamknięcie panelu) — nie wymagają Network, ale też nie powinny generować błędów.

### Gating beta — krytyczne

Beta Ideas jest **OTWARTA** (`betaAccess.ts:58` → `MYWORK_IDEAS: 'open'`; `betaAccess.ts:32` → `BETA_ADMINS_EXEMPT = true`). Status `'open'` = badge beta w navie, ale pełny dostęp dla wszystkich ról; lock NIE jest nakładany (`lockClosedBetaModules` dekoruje tylko statusy `'closed'`). Skutki dla testów Table:
- Zakładka Ideas w MyWorkHub jest widoczna i **klikalna dla każdej roli** — wchodzi do workspace, endpointy `/api/my-work/my-ideas/...` są wywoływane normalnie.
- Konto właściciela DBR77 nie jest wymagane do dostępu (przydatne tylko do uderzania w konkretne dane PROD). Dowolne konto org otwiera narzędzie.
- **Przed testami:** potwierdź że status nadal `'open'` (gdyby ktoś flipnął na `'closed'`, gating zmienia zachowanie — patrz §1.1 wariant zamknięty).

---

## Setup środowiska testowego

1. **Dev server:** uruchom `npm run dev` lub `npm run dev:full` — frontend `:3000`, backend `:3001`.
2. **Logowanie:** dowolne konto org — beta Ideas jest OTWARTA (`MYWORK_IDEAS: 'open'`), więc dostęp ma każda rola. Konto właściciela DBR77 (piotr.wisniewski@dbr77.com) przydatne tylko gdy chcesz uderzać w konkretne dane PROD.
3. **DevTools:** zakładka Network (filtr `my-ideas`) + Console (0 błędów = wymóg).
4. **Dane testowe:**
   - Utwórz co najmniej jedną ideę w M05 Ideas Management (lub użyj istniejącej).
   - Przejdź do workspace tej idei i wybierz narzędzie „Tabela" — to jest M08.
   - Przygotuj: plik CSV do importu (~5 wierszy, 3 kolumny), drugą ideę do relacji cross-table.
5. **Stany do weryfikacji po każdej akcji zapisu:** przeładuj (`F5`) stronę → stan musi przetrwać.
6. **Uwaga dev-backend:** dev backend uderza w PROD DB (`.env.local` nadpisuje `DATABASE_URL`). Wszystkie modyfikacje danych trafią do PROD. Testuj ostrożnie lub użyj konta sandbox.

---

## 1. Beta-gating i wejście do modułu

### 1.1 Dostęp do bety Ideas — OTWARTY dla każdej roli [FLAG]
- Stan kodu: `betaAccess.ts:58` → `MYWORK_IDEAS: 'open'`, `betaAccess.ts:32` → `BETA_ADMINS_EXEMPT = true`. Status `'open'` nie nakłada locka (`lockClosedBetaModules` dekoruje tylko `'closed'`).
- Zaloguj się jako zwykły user (nie admin/owner).
- Wejdź na `/my-work` → zakładka „Pomysły/Ideas" jest widoczna w nawigacji MyWorkHub (z badge beta).
- **Asercja:** klik zakładki Ideas → **przechodzi do workspace** (brak plate'a „dostęp ograniczony"); Network → normalne wywołania `/api/my-work/my-ideas/...`.
- **Dowód:** workspace otwarty; Console = 0 błędów; brak `access:blocked` / `BETA_LOCKED`.
- **Wariant kontrolny (gdy status flipnięty na `'closed'`):** jeśli `betaAccess.ts:58` = `'closed'` z `BETA_ADMINS_EXEMPT = true`, to zwykły user dostaje lock (plate `BETA_LOCKED`, brak wywołań `/api/my-work/my-ideas`), a admin/owner przechodzi. Testuj tę gałąź tylko jeśli faktycznie zmieniono SSOT.

### 1.2 Otwarcie workspace
- Zaloguj się dowolnym kontem org (beta otwarta).
- Wejdź na `/my-work/ideas` lub przez URL z `?ideaId=<id>`.
- **Asercja:** workspace idei otwiera się; toolbar narzędzi jest widoczny (Mind Map, Process Flow, Table, Whiteboard).
- Klik narzędzia „Tabela/Table" → `IdeaTableTool` montuje się; Network → `GET /api/my-work/my-ideas/:id/map` → HTTP 200.
- **Persist-check:** payload zawiera `extensions.table` (lub pusty obiekt dla nowej idei).

### 1.3 Empty-state przy nowej idei
- Utwórz nową ideę bez danych tabeli; wejdź w narzędzie Table.
- **Asercja:** widoczny `EmptyStateInline` z komunikatem zachęcającym do dodania wierszy/kolumn.
- Brak crash'a; Console = 0 błędów.

### 1.4 Error-state przy błędzie ładowania
- Symuluj błąd sieciowy (DevTools → Network → Offline lub zablokuj `/api/my-work/my-ideas`).
- **Asercja:** po chwili widoczny `EmptyStateInline` z komunikatem błędu + przycisk „Retry".
- Przywróć sieć → klik Retry → tabela ładuje się poprawnie.

---

## 2. Tworzenie tabeli i persist (EPIK-2)

### 2.1 Persist podstawowy — scenariusz S1 (krytyczny) [DB]
1. Wejdź do narzędzia Table dla istniejącej idei.
2. Dodaj 3 wiersze (przycisk „+ Dodaj wiersz" lub Enter na ostatnim wierszu).
3. Wypełnij kolumnę tekstową: wpisz wartości „Alpha", „Beta", „Gamma".
4. **Asercja Network:** po każdym keydown/blur → `POST /api/my-work/my-ideas/:id/map/sync` → HTTP 200. Payload zawiera `extensions.table.nodes` z 3 węzłami.
5. Przeładuj stronę (`F5`).
6. **Asercja persist:** 3 wiersze z wpisanymi wartościami nadal widoczne.
7. **[DB]:** sprawdź w DB `SELECT extensions_json FROM my_idea_maps WHERE idea_id = '<id>'` → `extensions.table.nodes` = 3 wpisy.

### 2.2 Autosave draft
- Wpisz coś w komórkę, NIE opuszczaj komórki (brak blur/Enter).
- **Asercja:** po ~2s wywołanie `/api/my-work/my-ideas/:id/map/sync` z payload zawierającym wpisany tekst (autosave draft; `useTablePersistence:290-293`).

### 2.3 Szablony frameworków (FrameworkGenerator)
- Klik przycisku „Framework Generator" lub opcji z menu toolbaru (jeśli widoczna).
- **Asercja:** otwiera się panel z listą dostępnych frameworków (minimum: SWOT).
- Wybierz SWOT → klik „Zastosuj framework / Apply framework".
- **Asercja:** tabela wypełnia się kolumnami i przykładowymi wierszami zgodnie z SWOT.
- **Persist-check:** przeładuj → struktura SWOT przetrwała.
- **Uwaga:** FrameworkGenerator używa hardcodowanych definicji (nie LLM) — brak wywołania AI w Network.

### 2.4 Import CSV [MANUAL]
- Klik przycisku importu CSV w toolbarze (`TableToolbar.tsx:1072`).
- Wybierz plik CSV z ~5 wierszami i 3 kolumnami.
- **Asercja:** wiersze z CSV trafiają do tabeli; mapowanie kolumn (header row = kolumny tabeli).
- **Persist-check:** przeładuj → zaimportowane dane przetrwały.
- **Negatywny:** input ma `accept=".csv,.tsv,.txt"` (`TableToolbar.tsx:1065`) — **`.txt` jest AKCEPTOWANY**, więc nie nadaje się na negatyw. Wybierz plik faktycznie odrzucany przez picker, np. `.xlsx` lub `.pdf` → plik nie przechodzi (lub ciche odrzucenie); sprawdź Console na brak crash.

### 2.5 Rename tabeli — KNOWN BUG [KNOWN-BUG] [EPIK-2]
- W tab-strip (jeśli widoczny — ścieżka B za flagą OFF, może być niewidoczny) lub w nazwie tabeli:
  - Wyszukaj w `IdeaTableTool.tsx` render handle rename (linia ~789: `handleTabRenameTable`).
  - Zmień nazwę tabeli przez dostępny UI (np. double-click na nazwie zakładki).
- **Asercja:** nazwa zmienia się w React state, pokazuje sukces (toast „Nazwa zmieniona").
- **KNOWN-BUG:** przeładuj stronę → nazwa **wraca do poprzedniej** (brak `PATCH` w Network podczas rename — widoczne w `IdeaTableTool.tsx:789-795` — tylko `setBaseTables` React state).
- **Dowód buga:** Network tab podczas rename = ZERO wywołań API. Po reload = stara nazwa.
- **Status:** P1 — znany bug do naprawy (L-02 w teczce M08).

---

## 3. Typy kolumn — każdy typ osobno (EPIK-1, F·C)

### 3.1 Dodawanie kolumny — mechanizm ogólny
- Klik „+ Dodaj kolumnę" lub ikona `+` w nagłówku tabeli.
- **Asercja:** otwiera się `AddColumnDialog` z listą typów kolumn.
- Wybierz typ, wpisz nazwę → zatwierdź.
- **Asercja Network:** `POST /api/my-work/my-ideas/:id/map/sync` — payload zawiera nową kolumnę w `extensions.table.columns`.
- **Persist-check:** przeładuj → kolumna widoczna z właściwym typem.

### 3.2 Typ: text
- Dodaj kolumnę text. Wpisz wartość wieloliniową z emoji i znakami specjalnymi.
- **Asercja:** wartość wyświetlona poprawnie; persist po reload.
- Wpisz pusty string → komórka pusta (nie null, nie crash).

### 3.3 Typ: number
- Dodaj kolumnę number. Wpisz: `42`, `-3.14`, `0`, `1e6`.
- **Asercja:** wartości wyświetlone jako liczby (nie string); sortowanie numeryczne (§5).
- Wpisz tekst np. `abc` → walidacja lub brak zapisu (nie crash).

### 3.4 Typ: select
- Dodaj kolumnę select z opcjami: „Niska", „Średnia", „Wysoka".
- Wpisz wartość w komórce → pojawia się dropdown z opcjami.
- Wybierz jedną opcję → komórka pokazuje wybrany chip.
- **Persist-check:** przeładuj → wartość i lista opcji przetrwały.
- Dodaj nową opcję bezpośrednio z komórki (jeśli możliwe).

### 3.5 Typ: multiselect
- Jak select, ale możliwość wybrania wielu wartości.
- **Asercja:** widoczne wiele chipów w komórce; persist po reload.

### 3.6 Typ: status
- Dodaj kolumnę status (podobne do select, ale z predefiniowanymi stanami: Todo/In Progress/Done lub lokalne PL).
- **Asercja:** zmiana statusu → odpowiedni chip z kolorem; persist.

### 3.7 Typ: date
- Dodaj kolumnę date. Klik komórki → date picker.
- Wybierz datę. **Asercja:** data w formacie `YYYY-MM-DD` w danych (sprawdź Network payload).
- Sortowanie po dacie — patrz §5.

### 3.8 Typ: checkbox
- Dodaj kolumnę checkbox. Klik → przełącza między `true`/`false`.
- **Asercja:** zmiana → sync w Network. Persist po reload.

### 3.9 Typ: rating
- Dodaj kolumnę rating (1–5 gwiazdek lub inny system).
- Klik na odpowiednią gwiazdkę → wartość zmienia się.
- **Persist-check:** przeładuj → wybrany rating przetrwał.

### 3.10 Typ: url
- Dodaj kolumnę url. Wpisz `https://example.com`.
- **Asercja:** wyświetlony jako klikalny link; poprawna wartość w Network payload.
- Wpisz niepoprawny URL → brak crash (UI zależy od implementacji).

### 3.11 Typ: formula [EPIK-1]
- Dodaj kolumnę formula. Wpisz formułę: `=SUM(children.effort)`.
- **Asercja:** kolumna oblicza wartość dla wierszy z dziećmi (krawędziami grafu).
- Przetestuj: `=IF(status="Done",10,0)`, `=CONCAT(label," - ",type)`, `=AVG(related.rating)`.
- **Asercja:** każda formuła zwraca wartość (nie crash, nie pustą komórkę) dla wierszy z odpowiednimi danymi.
- **Edge:** błędna formuła `=SUM(` → komunikat błędu w komórce lub toast; brak crash.

### 3.12 Typ: ai_generated
- Dodaj kolumnę `ai_generated` z promptem (np. „Oceń priorytet tego wiersza").
- Klik „AI Fill" (InlineAIFill) dla tej kolumny.
- **Asercja Network:** `POST /api/my-work/my-ideas/:id/ai-fill` → HTTP 200; payload zawiera wartości dla komórek.
- **Asercja UI:** komórki wypełnione wartościami (NIE wszystkie `'—'` — to sygnał cichego błędu).
- **Negatywny — ciche `'—'`:** jeśli LLM zwraca błąd → komórki = `'—'` bez toast błędu. To KNOWN-BUG (L-02). Odnotuj jeśli wystąpi.
- **Persist-check:** przeładuj → wartości AI przetrwały.

### 3.13 Typ: relation
- Dodaj kolumnę relation wskazującą na drugą ideę.
- Klik komórki → `LinkedRecordPicker` z listą dostępnych idei/wierszy.
- Wybierz powiązany wiersz. **Asercja:** link widoczny; `CrossTableRelations.tsx` wywołuje `GET /api/my-work/my-ideas/:otherId/map`.
- **Persist-check:** przeładuj → relacja przetrwała.

### 3.14 Typ: rollup
- Dodaj kolumnę rollup (np. `count` powiązanych wierszy z kolumny relation).
- **Asercja:** kolumna oblicza wartość automatycznie na podstawie powiązań.

### 3.15 Typy metadanych (created_time, created_by, last_edited_time, last_edited_by)
- Dodaj każdy z tych typów.
- **Asercja:** wartości wypełniane automatycznie (nie edytowalne ręcznie); `created_by` = nazwa zalogowanego użytkownika.
- **Persist-check:** przeładuj → wartości przetrwały.

### 3.16 Zmiana typu istniejącej kolumny
- Zmień typ kolumny text → number (lub inny kompatybilny).
- **Asercja:** zmiana zapisana w Network. Istniejące wartości: konwersja lub wyczyszczone (nie crash).
- **Persist-check:** przeładuj → nowy typ widoczny.

### 3.17 Usunięcie kolumny
- Usuń kolumnę (menu kontekstowe nagłówka lub drag-to-trash).
- **Asercja Network:** sync → payload nie zawiera usuniętej kolumny.
- **Persist-check:** przeładuj → kolumna niewidoczna; dane wierszy nie straciły pozostałych kolumn.

### 3.18 Zmiana szerokości kolumny [MANUAL]
- Przeciągnij krawędź nagłówka kolumny w prawo/lewo.
- **Asercja:** szerokość zmienia się; sync w Network (payload `columns[x].width`).
- **Persist-check:** przeładuj → szerokość przetrwała.

---

## 4. CRUD wierszy

### 4.1 Dodawanie wiersza
- Klik „+ Dodaj wiersz" lub naciśnij Enter na ostatnim wierszu w trybie edycji.
- **Asercja Network:** `POST /api/my-work/my-ideas/:id/map/sync` — nowy węzeł w `extensions.table.nodes`.
- **Persist-check:** przeładuj → nowy wiersz widoczny.
- Dodaj 20 wierszy → brak degradacji wydajności renderowania (scroll pionowy działa).

### 4.2 Edycja inline
- Klik w komórkę → tryb edycji (kursor w polu).
- Wpisz wartość → Tab przechodzi do następnej komórki, Enter do następnego wiersza.
- **Asercja:** po opuszczeniu komórki (blur) → sync w Network.
- **Persist-check:** przeładuj → wartość przetrwała.

### 4.3 Expand wiersza (RecordExpandModal)
- Double-click na wierszu lub klik ikony „Rozwiń" → otwiera `RecordExpandModal` ze wszystkimi polami.
- Edytuj wartości w modalu. **Asercja:** zmiana zapisana przy zamknięciu modalu lub autosave; sync w Network.
- Zamknij modal (X lub Escape) → powrót do widoku tabeli bez utraty zmian.

### 4.4 Usuwanie wiersza
- Zaznacz wiersz (checkbox w leftmost column) → klik „Usuń" lub menu kontekstowe.
- **Asercja Network:** sync → `extensions.table.nodes` nie zawiera usuniętego węzła.
- **Persist-check:** przeładuj → wiersz niewidoczny.
- Usuń wiersz, który ma relacje → sprawdź czy nie ma crash (osierocone linki to akceptowalne).

### 4.5 Bulk delete
- Zaznacz 3+ wierszy (checkboxy).
- Klik „Usuń zaznaczone" (bulk bar).
- **Asercja Network:** sync z `nodes` bez usuniętych węzłów.
- **Persist-check:** przeładuj → żaden z usuniętych wierszy nie wrócił.
- **Negatywny:** zaznacz 0 wierszy → bulk-delete disabled lub brak akcji.

### 4.6 Reorder wierszy [MANUAL]
- Przeciągnij wiersz (drag handle) na inną pozycję.
- **Asercja Network:** sync z `nodes` w nowej kolejności.
- **Persist-check:** przeładuj → kolejność przetrwała.

### 4.7 Dodaj sub-item
- Klik ikony „+ Sub-item" (jeśli widoczna) na wierszu z zagnieżdżonym modelem.
- **Asercja:** nowy wiersz-dziecko pojawia się z wcięciem; relacja parent-child w payload.
- **Persist-check:** przeładuj → zagnieżdżenie przetrwało.

### 4.8 Dodawanie wiersza z szablonu (RowTemplatePicker)
- Klik „+ Dodaj z szablonu" lub kliknięcie strzałki obok przycisku „+ Wiersz".
- **Asercja:** `RowTemplatePicker` otwiera się z dostępnymi szablonami.
- Wybierz szablon → nowy wiersz z pre-wypełnionymi polami.
- **Persist-check:** przeładuj → wiersz z szablonu przetrwał.

---

## 5. Sortowanie

### 5.1 Sortowanie po kolumnie tekstowej (single sort)
- Klik nagłówka kolumny text → asc / klik ponownie → desc / klik → brak sortowania (tri-state).
- **Asercja Network:** sync z `extensions.table.viewState.sort = {key: '...', direction: 'asc'/'desc'}`.
- **Asercja UI:** wiersze ułożone alfabetycznie (asc: A→Z; desc: Z→A).
- **Persist-check:** przeładuj → sort pozostaje aktywny.

### 5.2 Sortowanie po kolumnie numerycznej
- Jak 5.1 ale dla kolumny number.
- **Asercja:** sortowanie numeryczne (nie leksykograficzne: 9 < 10, nie „10" < „9").

### 5.3 Sortowanie po kolumnie date
- Jak 5.1 ale dla kolumny date.
- **Asercja:** sortowanie chronologiczne.

### 5.4 Reset sortowania
- Ustaw sort → klik nagłówka 3. raz lub klik ikony X przy aktywnym sortowaniu.
- **Asercja:** wiersze w oryginalnej kolejności; sync z `sort: null`.

### 5.5 Uwaga — multi-sort
- `SortConfig` ma jedno pole `key` i `direction` (brak tablicy sortów); wielopoziomowe sortowanie nie jest dostępne w UI legacy.
- Potwierdź: brak UI multi-sort → nie testujemy; odnotuj jako gap w raporcie.

---

## 6. Filtrowanie

### 6.1 Dodanie filtru — operator `contains`
- Otwórz panel filtrów (przycisk Filter w toolbarze).
- Dodaj regułę: kolumna text, operator `contains`, wartość „Alpha".
- **Asercja:** widoczne tylko wiersze zawierające „Alpha" w tej kolumnie.
- **Asercja Network:** sync → `extensions.table.viewState.filters` zawiera regułę.
- **Persist-check:** przeładuj → filtr aktywny.

### 6.2 Operator `equals`
- Dodaj regułę: kolumna text, operator `equals`, wartość „Beta".
- **Asercja:** tylko wiersz z dokładną wartością „Beta" (case-insensitive per implementację `useTableRows:89`).

### 6.3 Operator `not_empty` i `is_empty`
- Dodaj regułę: kolumna text, operator `not_empty`.
- **Asercja:** wiersze z niepustymi wartościami w tej kolumnie.
- Zmień na `is_empty` → wiersze z pustą lub brakującą wartością.

### 6.4 Operator `gt` i `lt` (tylko dla number)
- Dodaj regułę: kolumna number, operator `gt`, wartość `5`.
- **Asercja:** tylko wiersze z wartością > 5.
- Operator `lt`, wartość `3` → tylko wiersze < 3.

### 6.5 Operator `between` — KNOWN BUG [KNOWN-BUG] [EPIK-2]
- Dodaj regułę: kolumna number, operator `between`, wartość np. `3-7`.
- **KNOWN-BUG:** `useTableRows.ts:86-96` — `default: return true` → filtr `between` przepuszcza WSZYSTKIE wiersze (nie filtruje).
- **Dowód:** Network — sync zawiera regułę, ale UI pokazuje wszystkie wiersze bez filtrowania.
- **Status:** P1 bug otwarty (L-02); odnotuj FAIL w raporcie.

### 6.6 Operator `in` — KNOWN BUG [KNOWN-BUG]
- Jak `between` — `in` nie zaimplementowany, przepuszcza wszystkie wiersze.
- **Status:** P1 bug; odnotuj FAIL.

### 6.7 Logika filtrów AND/OR
- Dodaj 2 reguły.
- Przełącz logikę `AND` → `OR`.
- **Asercja AND:** wiersz widoczny tylko jeśli spełnia OBE reguły.
- **Asercja OR:** wiersz widoczny jeśli spełnia chociaż jedną.
- **Persist-check:** przeładuj → logika AND/OR przetrwała.

### 6.8 Filtr szybki (filterInput — searchbar)
- Wpisz tekst w pole wyszukiwania (filterInput).
- **Asercja:** filtruje po `label`, `type` i `id` wiersza (per `useTableRows:107-112`).
- Wyczyść pole → wszystkie wiersze wracają.

### 6.9 Usunięcie reguły filtra
- Klik X przy regule filtra → reguła znika; wiersze wracają do stanu bez filtra.
- **Asercja Network:** sync z `filters.rules = []`.

---

## 7. AI — NL command bar (EPIK-2, F·D)

### 7.1 Otwarcie AITableAssistant
- Wpisz `/` w komórce lub klik przycisk AI command w toolbarze.
- **Asercja:** `AITableAssistant` otwiera się z przykładowymi komendami (`EXAMPLE_COMMANDS` EN/PL).

### 7.2 Komenda sort — S2 (scenariusz krytyczny)
1. Wpisz komendę: „Posortuj po priorytecie malejąco" (PL) lub „Sort by priority descending" (EN).
2. **Asercja Network:** `POST /api/my-work/my-ideas/:id/ai-table-action` → HTTP 200.
3. **Asercja payload:** `action.type = 'sort'`, parametry sort zgodne z intencją.
4. **Asercja UI:** tabela sortuje się po kolumnie priorytet malejąco.
5. **Persist-check:** przeładuj → sort widoczny.

### 7.3 Komenda filter
- Komenda: „Pokaż tylko elementy o wysokim wpływie".
- **Asercja Network:** `ai-table-action` → `action.type = 'filter'`; reguła filtra dodana do viewState.
- **Asercja UI:** wiersze przefiltrowane.

### 7.4 Komenda group
- Komenda: „Grupuj po statusie".
- **Asercja:** `action.type = 'group'`; tabela przechodzi do widoku grupowanego (groupBy ustawione).
- **Persist-check:** przeładuj → groupBy przetrwał.

### 7.5 Komenda add_column
- Komenda: „Dodaj kolumnę Termin typu data".
- **Asercja Network:** `ai-table-action` → `action.type = 'add_column'`; nowa kolumna date w tabeli.

### 7.6 Komenda add_rows
- Komenda: „Dodaj 5 wierszy o ryzykach transformacji cyfrowej".
- **Asercja Network:** `ai-table-action` → `action.type = 'add_rows'`; 5 nowych węzłów w nodes.
- **Asercja UI:** 5 wierszy z treścią AI widoczne.

### 7.7 Komenda summarize
- Komenda: „Podsumuj tabelę".
- **Asercja Network:** `ai-table-action` → `action.type = 'summarize'`; odpowiedź widoczna w UI (panel lub toast).

### 7.8 Komenda generate_table — KNOWN BUG [KNOWN-BUG] [EPIK-2]
- Komenda: „Stwórz tabelę oceny ryzyka dla transformacji cyfrowej".
- **KNOWN-BUG:** `ideaAISuggestionsService.ts:391-402` — prompt LLM nie zawiera akcji `generate_table` w liście typów → LLM nigdy nie wygeneruje tej akcji → odpowiedź type `error` lub brak akcji.
- **Dowód:** Network → `ai-table-action` → HTTP 200 ale `action.type` ≠ `generate_table` (prawdopodobnie `sort`, `filter` lub `error`).
- **Status:** P1 bug (L-02); odnotuj FAIL w raporcie.

### 7.9 Fenced JSON — REGRESJA (bug naprawiony) [EPIK-2]
- Historyczny bug L-02: LLM opakowywał JSON w ````json ... ```` fences → surowy `JSON.parse` rzucał.
- **Stan kodu (NAPRAWIONY):** `ideaAISuggestionsService.ts:425-426` stripuje fences przed parsowaniem (`rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()`), a całość owinięta w `try/catch` (`:427-432`) → przy błędzie zwraca `{type:'error'}` zamiast crashować. Ten sam wzorzec fence-strip w ai-fill (`:485-486`).
- **Test (potwierdź regresję):** wykonaj kilka komend AI (§7.2–§7.7) i sprawdź Console — BRAK `JSON.parse error` / `Uncaught SyntaxError`. Nawet gdy LLM zwróci fenced JSON, akcja przechodzi albo degraduje do `type:'error'` (toast/no-op), nie crash.
- **Status:** PASS oczekiwany; odnotuj FAIL tylko jeśli pojawi się surowy `JSON.parse` error (regresja).

### 7.10 Zamknięcie AI command bar
- Naciśnij Escape lub klik X → `AITableAssistant` zamknięty bez zmian.
- **Asercja:** brak wywołań Network przy zamknięciu bez wysłania.

---

## 8. AI — Fill komórek (ai-fill) (EPIK-2)

### 8.1 AI fill dla kolumny ai_generated — S3 (scenariusz krytyczny)
1. Dodaj kolumnę `ai_generated` z promptem np. „Oceń priorytet (1-5)".
2. Dodaj 3-5 wierszy z treścią w kolumnie text.
3. Klik „AI Fill" (InlineAIFill lub BatchAIFillButton przy nagłówku kolumny).
4. **Asercja Network:** `POST /api/my-work/my-ideas/:id/ai-fill` → HTTP 200.
5. **Asercja UI:** komórki mają wartości (NIE wszystkie `'—'`).
6. **Persist-check:** przeładuj → wartości przetrwały.

### 8.2 Cichy fallback `'—'` — KNOWN BUG [KNOWN-BUG]
- Jeśli LLM zwraca błąd (odetnij sieć, symuluj błąd AI) → wszystkie komórki = `'—'` bez komunikatu.
- **KNOWN-BUG:** `ideaAISuggestionsService.ts:491-492` — `catch { return rows.map(r => ({ rowId: r.id, value: '—' })) }`, brak toast/error przy błędzie LLM.
- **Dowód:** brak toast w UI; komórki = `'—'`.
- **Status:** P2 bug (L-02); odnotuj FAIL.

### 8.3 AI fill dla pustej tabeli
- Uruchom AI fill na tabeli bez wierszy → brak crash; ewentualny toast „Brak wierszy do wypełnienia".

---

## 9. AI — Copilot (AICopilotMode)

### 9.1 Otwarcie Copilot
- Klik przycisku Copilot w toolbarze.
- **Asercja:** panel Copilot otwiera się; pole wpisywania aktywne.

### 9.2 Wysłanie wiadomości do Copilot
- Wpisz pytanie: „Co masz na myśli przez te dane?".
- **Asercja Network:** `POST /api/my-work/my-ideas/:id/ai-suggestions` → HTTP 200.
- **Asercja UI:** odpowiedź pojawia się z animacją streamingu.

### 9.3 Fałszywy streaming — KNOWN BUG [KNOWN-BUG] [EPIK-2]
- Podczas odbierania odpowiedzi obserwuj DevTools Network.
- **KNOWN-BUG:** `AICopilotMode.tsx:117-131` `simulateStreaming()` — pełna odpowiedź przychodzi jednorazowo (nie ma prawdziwego streaming), potem wypisywana setIntervalem.
- **Dowód:** Network → jedna pełna odpowiedź HTTP 200 (nie stream chunks); UI wypisuje jakby streamowała.
- **Status:** P2 bug (L-02); odnotuj jako observation.

### 9.4 Tryby Copilot: brainstorm, devil's advocate, expand, summarize
- Sprawdź czy są dostępne tryby w panelu Copilot (switcher trybu).
- Przetestuj każdy tryb: wyślij wiadomość → odpowiedź różni się charakterem (brainstorm = wiele pomysłów; devil's advocate = kontrargumenty).
- **Asercja Network:** payload zawiera `mode: 'brainstorm'/'devil_advocate'/'expand'/'summarize'`.

### 9.5 Zamknięcie panelu Copilot
- Klik X lub Escape → panel zamknięty; żaden pending request nie powinien kontynuować.

---

## 10. AI — Kategoryzacja i scoring

### 10.1 AICategorizeTool
- Otwórz narzędzie kategoryzacji (jeśli dostępne z menu lub toolbaru).
- **Asercja Network:** `POST /api/my-work/my-ideas/:id/ai-suggestions` lub dedykowany endpoint.
- **Asercja UI:** wiersze zgrupowane w kategorie z confidence score.
- **KNOWN-BUG (cichy fallback):** przy błędzie LLM → lokalne klastrowanie po pierwszym słowie labela z confidence=0.5 udające AI (`AICategorizeTool.tsx:94-118`) — brak komunikatu o degradacji.
- **Test:** odetnij AI (zły klucz API lub offline) → sprawdź czy UI pokazuje ostrzeżenie czy cicho degraduje.

### 10.2 IdeaScoringModel
- Otwórz panel scoringu (jeśli dostępny).
- **Asercja:** każdy wiersz otrzymuje score; Network → wywołanie AI endpoint.
- **Persist-check:** przeładuj → scoring przetrwał.

---

## 11. Eksport (EPIK-1, F·E)

### 11.1 Eksport CSV
- Klik przycisku CSV Export w toolbarze.
- **Asercja Network:** `GET /api/my-work/my-ideas/:id/export-csv` → HTTP 200; Content-Type: `text/csv`.
- **Asercja plik:** plik CSV pobrany; zawiera nagłówki = nazwy kolumn; wiersze = dane tabeli.
- **Persist:** brak zmian w tabeli po eksporcie.

### 11.2 Eksport do prezentacji — S5 (scenariusz krytyczny)
1. Klik przycisku „Eksportuj do prezentacji" lub `ExportToPresentation`.
2. **Asercja Network:** `POST /api/presentations/decks` → HTTP 200 lub 201; payload zawiera dane tabeli.
3. **Asercja UI:** potwierdzenie sukcesu (toast lub modal z linkiem do decka).
4. Przejdź do M17 Outputs/Prezentacje → sprawdź czy deck istnieje z danymi z tabeli.
5. **Persist:** deck trwały po przeładowaniu modułu prezentacji.

### 11.3 Eksport CSV — pusta tabela
- Kliknij CSV Export na tabeli bez wierszy → plik z samymi nagłówkami (nie crash, nie 500).

---

## 12. Konwersja wierszy do innych encji (E · integracje cross-module)

### 12.1 Konwersja wierszy → Inicjatywy [EPIK-1]
- Zaznacz 2 wiersze (checkboxy).
- Klik menu kontekstowe → „Konwertuj do inicjatywy / Convert to initiative" (akcja `tbl_convert_initiative` w `IdeaMapWorkspace.tsx:877`).
- **Asercja Network:** POST do inicjatyw (sprawdź endpoint); HTTP 200/201.
- **Asercja cross-module:** przejdź do M13 Inicjatywy → nowe inicjatywy widoczne z treścią z wierszy.

### 12.2 Konwersja wierszy → Zadania
- Jak 12.1, akcja `tbl_convert_task_set`.
- **Asercja:** przejdź do M03 Zadania → nowe zadania widoczne.

---

## 13. Widoki (7 layoutów legacy)

### 13.1 Przełączanie widoków
- Sprawdź dostępność przełącznika widoków (Timeline, Sticky, Kanban, Calendar, Grid/Gallery, Matrix, Table).
- **Asercja:** klik każdego widoku → odpowiedni layout renderuje się bez crasha.
- **Persist-check:** przeładuj → ostatni aktywny widok przywrócony (`activeViewId` w `extensions.table.viewState`).

### 13.2 Widok Kanban
- Przejdź do widoku Kanban.
- **Asercja:** wiersze pogrupowane po kolumnie status/select jako kolumny kanban.
- Przeciągnij kartę między kolumnami [MANUAL] → wartość statusu zmienia się; sync w Network.

### 13.3 Widok Matrix z wyborem osi
- Przejdź do widoku Matrix.
- Wybierz osie X i Y (kolumny numeryczne lub select).
- **Asercja:** wiersze pozycjonowane na matrycy; persist osi po reload.

### 13.4 Widok Kalendarz
- Przejdź do widoku Calendar.
- **Asercja:** wiersze z kolumną date widoczne na kalendarzu; wiersze bez dat — w sekcji bez daty.

### 13.5 Zapisane widoki (SavedViews)
- Skonfiguruj sort + filter + groupBy → zapisz widok przez UI.
- **Asercja Network:** sync → `extensions.table.savedViews` zawiera nowy wpis.
- Przeładuj → widok dostępny w liście; klik → przywraca sort/filter/groupBy.
- Usuń zapisany widok → nie ma w liście; persist po reload.

---

## 14. Zepsute przyciski (EPIK-1 — L-01) [KNOWN-BUG]

### 14.1 Przycisk Import/Konektory — S4 (scenariusz krytyczny)
- Klik przycisku „Konektory" lub „Import" w `TableToolbar.tsx:1043-1065`.
- **KNOWN-BUG:** `useConnectors.ts:112` → `GET /api/workspaces/:id/connectors` → HTTP 404 (mount nie istnieje; prawidłowy path to `/api/table-platform/connectors`).
- **Dowód:** Network → 404 przy kliknięciu.
- **Status:** P1 bug (L-01); odnotuj FAIL.

### 14.2 Przycisk ActivityFeed
- Klik przycisku ActivityFeed w toolbarze (`IdeaTableTool.tsx:1828`).
- **Stan kodu (KOREKTA audytu):** `ActivityFeed.tsx:150-152` używa `Api.get('/table-platform/tables/:id/audit?limit=50')` — Api dokleja prefix `/api` ORAZ Authorization header (NIE surowy `fetch` bez auth). Route jest zamontowany (`Gateway.ts:946` → `/api/table-platform`) i strzeżony `requireTableAccess` (`table-platform.routes.ts:1926`).
- **Realne zachowanie:** to NIE jest „zawsze 401 z braku auth". Wynik zależy od dostępu i od tego, czy istnieje rekord tabeli platformy dla tej idei (ścieżka B / `ENABLE_TABLE_PLATFORM_METADATA_FIRST=false` → tabela platformy zwykle nie istnieje). Oczekiwane: 200 z pustą listą **albo** 403/404 z `requireTableAccess` gdy brak tabeli/dostępu — błąd jest połykany cicho (panel pokazuje empty state, bez crash).
- **Dowód:** Network → odczytaj realny kod (200/403/404) + sprawdź że na żądaniu JEST nagłówek `Authorization`. Odnotuj faktyczny status — nie zakładaj 401.
- **Status:** zweryfikuj w runtime; klasyfikuj wg realnego kodu HTTP (to access/empty-state, nie no-auth-401).

### 14.3 Przycisk AuditTrail
- Klik przycisku AuditTrail w toolbarze (jeśli widoczny).
- **Stan kodu (KOREKTA audytu):** `AuditTrailPanel.tsx:179-181` → `fetch('/api/table-platform/tables/${tableId}/audit?...', { headers: getHeaders() })` — Z auth, poprawny path. Route ISTNIEJE i jest zamontowany (`Gateway.ts:946` + `table-platform.routes.ts:1926`, `requireTableAccess`). To NIE jest 404-brak-mountu z `/api/tables/:id/audit`.
- **Realne zachowanie:** access-check przez `requireTableAccess` + zależność od istnienia rekordu tabeli platformy. Oczekiwane: 200 (lista rewizji) albo 403/404 z guardu gdy brak tabeli/dostępu; błąd połknięty cicho (`catch {}` → empty state).
- **Dowód:** Network → realny kod HTTP na `/api/table-platform/tables/:id/audit` + obecny `Authorization`. Odnotuj faktyczny status.
- **Status:** zweryfikuj w runtime; klasyfikuj wg realnego kodu HTTP (to access/empty-state, nie 404-brak-mountu).

### 14.4 SnapshotManager
- Sprawdź czy przycisk Snapshot jest widoczny (`IdeaTableTool.tsx:1837`).
- Teczka audytu twierdzi że usunięty (commit `f35aa8d7c8`) — zweryfikuj czy przycisk jest w UI.
- Jeśli widoczny i klikany → sprawdź Network; oczekiwane: 404 lub brak przycisku.
- **Asercja docelowa:** przycisk niewidoczny (usunięty per karta audytu).

---

## 15. Undo/Redo i klawiatura [MANUAL]

### 15.1 Ctrl+Z / Ctrl+Y — undo/redo
- Dodaj wiersz → `Ctrl+Z` → wiersz znika.
- `Ctrl+Z` ponownie → kolejny krok cofnięty (bufor 50 kroków per `useUndoRedo.ts:11-25`).
- `Ctrl+Y` (lub `Ctrl+Shift+Z`) → redo.
- **Asercja:** każde undo/redo → sync w Network z właściwym stanem `nodes`.
- **Edge:** 51 operacja → najstarsza nie jest w buforze; brak crash.

### 15.2 Tab i Enter
- W trybie edycji komórki: Tab → następna komórka w prawo; Shift+Tab → w lewo.
- Enter → następny wiersz (ta sama kolumna).
- Escape → wyjście z trybu edycji bez zapisu.

### 15.3 Strzałki
- ArrowDown / ArrowUp → nawigacja między wierszami (bez edycji).
- **Asercja:** focus zmienia się; brak scroll jump (scroll powinien podążać za focusem).

### 15.4 Skrót otwierający AI command bar
- `/` (slash) w komórce → `AITableAssistant` otwiera się.
- Escape → zamknięcie; kursor wraca do komórki.

---

## 16. Conflict 409 i multi-writer [FLAG]

### 16.1 Conflict 409 — state conflict
- Otwórz tę samą ideę w dwóch oknach przeglądarki (tab A i tab B, zalogowany tym samym user).
- W tab A: dodaj wiersz → sync `baseVersion=1`.
- W tab B: przed sync z A, dodaj inny wiersz → sync `baseVersion=1` → serwer ma już `version=2` → **HTTP 409**.
- **Asercja tab B:** `useIdeaMapSync:264` → `setSyncState('conflict')` → UI pokazuje stan „Konflikt zmian" (per `formatIdeaMapSyncLabel`).
- **Asercja [KNOWN-BUG]:** per `_INDEX_IDEAS_SPLIT.md` punkt 2: toast „odświeżam" bez faktycznego refreshu + podbicie wersji → następny zapis po cichu nadpisuje dane serwera. Odnotuj czy tak jest.

### 16.2 Offline recovery
- Idź offline (DevTools Network → Offline); dodaj wiersze → sync state = `offline`.
- Wróć online → automatyczny retry; state = `saved`.
- **Asercja:** dane zbuforowane offline nie są tracone.

---

## 17. Przekrojowe ścieżki cross-module

### 17.1 Ideas Table → Canvas (M02)
- Otwórz narzędzie Table w workspace idei.
- Klik przycisk „Canvas" lub otwórz Canvas z tego kontekstu (jeśli dostępny, `IdeaMapWorkspace.tsx:2891`: `onTableContextChange`).
- **Asercja:** Canvas otwiera się z danymi tabeli jako kontekstem (prompt AI w Canvas zawiera dane z tabeli).

### 17.2 Ideas Table → Czat (M01)
- Otwórz panel czatu Teresa z poziomu workspace idei (panel czatu kontekstowy w workspace).
- **Asercja:** Teresa otrzymuje kontekst tabeli (artifact context z `IdeaTableTool.tsx:2457-2465`).
- Wyślij pytanie do Teresy o dane z tabeli → odpowiedź odnosi się do zawartości tabeli.

### 17.3 Ideas Table → Inicjatywy (M13) — konwersja
- Patrz §12.1.

### 17.4 Ideas Table → Tabele Studio M20 — ścieżka B (UKRYTA) [FLAG]
- Flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST=false` → ścieżka B nieaktywna; żadne wywołania `/api/table-platform/*` przez narzędzie nie powinny się zdarzać (z wyjątkiem connectors-bug §14.1).
- **Asercja:** Network podczas normalnego korzystania z tabeli = ZERO wywołań `/api/table-platform/` (oprócz znanych bugów z §14).

---

## 18. Przekrojowe: persistencja, viewport, i18n, dark mode, A11y

### 18.1 Pełna persistencja po reload
- Wykonaj kompleksowe działania: 5 wierszy z różnymi typami kolumn, sort, filtr, widok kanban → przeładuj.
- **Asercja:** cały stan (wiersze + sort + filtr + viewState + kolumny) przetrwał bez straty.

### 18.2 Scroll poziomy — wiele kolumn
- Dodaj 10+ kolumn, tak żeby tabela wymagała przewijania poziomego.
- **Asercja:** scroll poziomy działa (pasek scrollbar lub przewijanie touchpadem); header kolumn zamrożony (sticky) podczas scrollu.
- Kolumny `frozen=true` — sprawdź czy pierwsza kolumna pozostaje na miejscu.

### 18.3 i18n PL / EN
- Przełącz język na EN → UI toolbaru, dialogi, toasty, przykładowe komendy AI wyświetlane po angielsku.
- Przełącz na PL → polskie tłumaczenia.
- **Asercja:** brak widocznych anglojęzycznych stringów w trybie PL (i odwrotnie). Uwaga: `IdeaTableTool.tsx` używa wzorca `isPl ? 'PL string' : 'EN string'` zamiast kluczy i18n — funkcjonalnie OK, sprawdź kompletność.

### 18.4 Dark mode
- Przełącz theme na dark → cała tabela (nagłówki, komórki, toolbar, panele) wyświetla się bez białych prostokątów lub nieczytelnych tekstów na ciemnym tle.
- Klas dark: `dark:bg-navy-*`, `dark:border-*`, `dark:text-*` — sprawdź wizualnie.

### 18.5 A11y — klawiatura w tabeli [MANUAL]
- Nawiguj przez całą tabelę WYŁĄCZNIE klawiaturą (Tab, Shift+Tab, Enter, Escape, strzałki).
- **Asercja:** żadna komórka, przycisk, dialog nie jest nieosiągalny klawiaturą.
- Focus indicator widoczny na aktywnym elemencie (outline, ring).
- Screen reader (opcjonalnie): `aria-label` na kluczowych przyciskach toolbaru.

### 18.6 Zero błędów w Console
- Przez cały czas testów → Console = 0 red errors.
- Dopuszczalne: ostrzeżenia (warnings) dot. znanych bugów.
- Niedopuszczalne: `Uncaught Error`, `JSON.parse error`, `undefined is not a function`, `Cannot read property of null`.

### 18.7 Disabled state podczas zapisu
- Sprawdź czy podczas trwającego sync (sync state = `saving`) przyciski krytyczne są zablokowane (disabled lub spinner).
- Brak podwójnego wysłania tego samego payloadu.

---

## 19. Testy regresji — automatyczne (EPIK-5)

> Uruchom przed lub po testach manualnych; wyniki dołącz do raportu.

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx vitest run src/components/MyWork/table
```

**Oczekiwane:** wszystkie 137+ testów PASS (0 FAIL, 0 SKIP; czas ~3-8s).

| Plik | Zakres | Liczba |
|---|---|---|
| `table/__tests__/TablePlatformFrontend.test.tsx` | Bridge, mappery, ActivityFeed path | ~37 |
| `table/__tests__/PlatformCellRenderer.specialized.test.tsx` | Renderery platf. | ~10 |
| `table/cells/__tests__/PriorityCell.test.tsx` | Komórka priorytet | ~5 |
| `table/cells/__tests__/RiskScoreCell.test.tsx` | Komórka ryzyko | ~5 |
| `table/cells/__tests__/AiClassificationCell.test.tsx` | Komórka klasyfikacja | ~5 |
| `table/cells/__tests__/AiSummaryCell.test.tsx` | Komórka podsumowanie | ~5 |
| `table/cells/__tests__/SourceReferenceCell.test.tsx` | Komórka źródło | ~5 |
| `table/provenance/__tests__/` (5 plików) | Proweniencja | ~50 |
| `table/forms/__tests__/IntakeJwtPanel.test.tsx` | Formularz intake | ~5 |
| `table/forms/__tests__/PublicJwtFormPage.test.tsx` | Publiczna strona | ~5 |

**Uwaga luki:** Testy pokrywają głównie ścieżkę platformy (wyłączoną w prod). Brak testów dla `useTablePersistence`, `useTableRows`, `FormulaEngineV2` — to co faktycznie działa u klientów.

**CI:** wszystkie 137 testów jest POZA CI (`.github/workflows/test-suite.yml` uruchamia tylko `tests/unit` i `tests/integration`). Odnotuj w raporcie.

---

## 20. Mapa epików → sekcje testów

| Epik (teczka M08) | Sekcje testów | Status do weryfikacji |
|---|---|---|
| EPIK 1 — 4 przyciski bez zawsze-błąd | §14 (14.1–14.4) | Zepsute (znane bugi L-01) |
| EPIK 2 — Uczciwe AI + rename + between/in | §7.8, §7.9, §8.2, §9.3, §6.5, §6.6, §2.5 | Zepsute (znane bugi L-02) |
| EPIK 3 — org-scope | §0 (architektura, poza manualnym testowaniem) | Weryfikacja w kodzie |
| EPIK 4 — Martwy kod + dual-stack | §17.4 (flaga OFF), §14.4 (Snapshot usunięty) | Decyzja DP-7 |
| EPIK 5 — Testy do CI | §19 (automatyczne) | 137 testów poza CI |
| F·A Trwałość | §2.1–2.2, §18.1 | Krytyczne (S1) |
| F·B Typy kolumn | §3 (3.1–3.18) | Pełne pokrycie |
| F·C CRUD wierszy | §4 (4.1–4.8) | Pełne pokrycie |
| F·D AI | §7–§10 | Częściowe (znane bugi) |
| F·E Eksport/Integracje | §11–§12 | S5 krytyczne |
| F·F Widoki | §13 (13.1–13.5) | 7 layoutów legacy |
| F·G Klawiatura | §15 | MANUAL |
| F·H Conflict/Collab | §16 | FLAG |
| F·I Cross-module | §17 | 4 ścieżki |
| F·J Przekrojowe | §18 | i18n/dark/a11y |

---

## 21. Format raportu

Każdy test dokumentowany jako:

```
[M08-<Sekcja>.<Punkt>] <Tytuł>
STATUS: PASS | FAIL | SKIP | KNOWN-BUG
Dowód: <opis: screenshot/Network/payload/reload-check>
Uwagi: <opcjonalnie>
```

Przykłady:
```
[M08-2.1] Persist podstawowy S1
STATUS: PASS
Dowód: Network → POST /api/my-work/my-ideas/123/map/sync → 200; po reload 3 wiersze zachowane; extensions_json zawiera nodes[3]

[M08-7.8] Komenda generate_table
STATUS: KNOWN-BUG (L-02)
Dowód: Network → ai-table-action → 200 ale action.type='error'; tabela nie wygenerowana

[M08-14.1] Przycisk Import/Konektory
STATUS: KNOWN-BUG (L-01)
Dowód: Network → GET /api/workspaces/456/connectors → 404
```

---

## Definition of Done (M08)

Moduł M08 uznaje się za gotowy do tier Beta gdy:

- [ ] **S1 PASS** — persist po reload: 3 wiersze z różnymi typami kolumn przetrwały przeładowanie
- [ ] **S2 PASS** — AI NL sort działa (ai-table-action HTTP 200 + tabela posortowana)
- [ ] **S3 PASS** — AI fill wypełnia komórki (nie `'—'`; Network HTTP 200)
- [ ] **S4** — 4 zepsute przyciski naprawione (HTTP 200) lub ukryte (niewidoczne); BRAK 404/401 w Network podczas normalnej pracy
- [ ] **S5 PASS** — Export to Presentation → deck istnieje w M17
- [ ] Zero crash w Console przez cały przebieg testów (§18.6)
- [ ] Rename tabeli trwały po reload (§2.5 — bug naprawiony)
- [ ] Filtry `between`/`in` działają (§6.5/§6.6 — bug naprawiony)
- [ ] 137 testów auto PASS (`npx vitest run src/components/MyWork/table`)
- [ ] Testy auto w CI gate Londyn (§19 — brak w CI = blokada tier Beta)
