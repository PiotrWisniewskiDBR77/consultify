# TESTY — M20 Tabele Studio (Table Platform, Airtable-like)

> **Moduł:** M20 Tabele Studio (`/tabele`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja TABELE STUDIO, poz. 1–16)
> **Zakres tej paczki:** cały module — Records API, bazy/tabele, widoki, formuły v2, AI Editor 8 poziomów, realtime+presence, automatyzacje, formularze publiczne, governed models, flag rozjazd (4 flagi BE ON vs komentarze), FE flagi OFF (QA/SourcePack/Conversions), konwersja Table→Doc/Deck, cross-module i ścieżki bezpieczeństwa.
> **Cel:** agent piszący i testujący moduł ma dogłębnie przetestować 193 endpointy (audyt na PRÓBCE+WZORCU per karta §0), weryfikując E2E: UI + payload Network + wiersz DB. **Każde twierdzenie o PASS musi być udowodnione w Network DevTools — sama zmiana w UI to FAIL.**
> **Wzorzec formatu:** `Harvard/Testy manualne/TESTY_M01_CZAT.md`. Legenda z M03: `[MANUAL]` = ręczna weryfikacja, `[FLAG]` = zależne od flagi/roli, `[DB]` = dowód w bazie.
> **Grounding:** karta audytu `Harvard/modules/M20-tabele-studio/KARTA_AUDYTU.md` + teczka `Harvard/wdrozenie-100/M20-tabele-studio.md` + kod `server/src/routes/table-platform.routes.ts` (5203 l.) + `table-platform.ai-editor.routes.ts` + `FeatureFlags.ts` + `SchemaValidationService.ts` + `SpecializedFieldTypes.ts` + `levelMeta.ts`.
> **Ocena audytu:** 48/100 · Tier Alpha · Beta closed · IDOR P0 naprawiony `e9c6cb9c0a`.
> **Data:** 2026-06-16

---

## §0. Kontekst architektoniczny (przeczytaj przed testami)

### Mapa komponentów FE

| Komponent | Plik | Stan |
|---|---|---|
| `TabeleView` (orchestrator) | `src/components/AIChat/KimiWorkspace/TabeleView.tsx` | `isMelsTabeleEnabled()`, `useKimiArtifactPipeline` |
| `TabeleMelsView` (MELS shell) | `…/tabeleShell/TabeleMelsView.tsx` | za flagą `melsTabeleFlag` default OFF → fallback `KimiWorkspaceShell` |
| `TabeleLeftRail` | `…/tabeleShell/TabeleLeftRail.tsx` | nawigacja baz/tabel |
| `TabeleTopBarChips` | `…/tabeleShell/TabeleTopBarChips.tsx` | akcje globalne widoku |
| `TabeleRightRail` | `…/tabeleShell/TabeleRightRail.tsx` | AI Editor + QA panele |
| `TabeleAiEditorPanel` | `…/tabeleShell/aiEditor/TabeleAiEditorPanel.tsx` | 8 poziomów, apply/reject |
| `ProposalDiffCard` | `…/tabeleShell/aiEditor/ProposalDiffCard.tsx` | diff propozycji AI |
| `TabelePreviewLayout` | `…/tabelePreview/TabelePreviewLayout.tsx` | podgląd tabeli |
| `PublicViewPage` | (szukaj w routes/public) | widok publiczny share |

**Backend:** `server/src/routes/table-platform.routes.ts` (193 EP, 5203 l.) + osobne routery: `table-platform.ai-editor.routes.ts` (4 EP), `table-platform.qa.routes.ts` (3 EP), `table-platform.conversion.routes.ts` (4 EP), `table-platform.source-pack.routes.ts` (6 EP), `table-platform.form-public.routes.ts` (2 EP), `table-platform.relations-explain.routes.ts`, `table-platform.record-sources.routes.ts`.

**Serwisy kluczowe:** `PermissionsService.ts` (510 l., per-base RBAC), `SchemaValidationService.ts` (typy pól), `TableAiEditorService.ts` (8 poziomów), `FormService.ts`, `ModuleSyncService.ts` (governed sync STUB), `ScheduledAutomationExecutor` (automatyzacje), `FormulaEngineV2`.

**Model DB:** realny Postgres `tp_*` (tabele: `tp_bases`, `tp_tables`, `tp_fields`, `tp_records`, `tp_views`, `tp_automations`, `tp_automation_runs`, `tp_forms`, `tp_form_submissions`, `tp_governed_models`, `tp_schema_proposals`, `tp_module_sync_results`, migracje 700–726 + 777–778).

### Records API — default ON

`ENABLE_TABLE_PLATFORM_RECORDS_API` = **default ON** (`FeatureFlags.ts:75` — `!== 'false'`). Jeśli migracje `tp_*` nie są zastosowane, API zwraca **503 `SCHEMA_NOT_READY`** zamiast cicho padać.

### Rozjazd 4 flag BE (KRYTYCZNE)

Po R3 (weryfikacja 2026-06-13) stan flag w SSOT `FeatureFlags.ts` jest następujący:

| Flaga | Komentarz w SSOT (`FeatureFlags.ts`) | Runtime default | Stary komentarz (tylko w route-header) | Status rozjazdu |
|---|---|---|---|---|
| `ENABLE_TABLE_AI_EDITOR` | „Enabled by default; set ...=false to disable" | **ON** (`:84` `!=='false'`) | route-header `ai-editor.routes.ts:36` mówi „disabled by default" | **P3-doc** — SSOT spójny, stary komentarz w 1 pliku route-header wymaga uspójnienia |
| `ENABLE_TABLE_QA_ENGINE` | „Enabled by default; set ...=false to disable" | **ON** (`:89` `!=='false'`) | brak starego komentarza w route | SSOT spójny |
| `ENABLE_TABLE_SOURCE_PACK` | „Enabled by default; set ...=false to disable" | **ON** (`:94` `!=='false'`) | brak starego komentarza | SSOT spójny |
| `ENABLE_TABLE_ARTIFACT_CONVERSION` | „Enabled by default; set ...=false to disable" | **ON** (`:99` `!=='false'`) | brak starego komentarza | SSOT spójny |

**Wniosek dla testera:** wszystkie 4 flagi są **runtime ON na dev**. FE chowa UI dla QA/SourcePack/Conversions (FE defaulty OFF), ale BE jest żywe — każdy wywołuje API nawet gdy UI jest ukryte. §10 testuje to systematycznie.

### FE flagi OFF

| Flaga FE | Plik | Default | Efekt |
|---|---|---|---|
| `melsTabeleFlag` (MELS shell) | `src/utils/melsTabeleFlag.ts` lub store | OFF | fallback do `KimiWorkspaceShell` |
| `tabeleQaFlag` | `src/utils/tabeleQaFlag.ts` | OFF | QA panel niewidoczny w UI |
| `tabeleSourcePackFlag` | `src/utils/tabeleSourcePackFlag.ts` | OFF | Source Pack niewidoczny w UI |
| `tabeleConversionsFlag` | `src/utils/tabeleConversionsFlag.ts` | OFF | konwersja Table→Doc/Deck niewidoczna w UI |
| `tabeleAiEditorFlag` | `src/utils/tabeleAiEditorFlag.ts` | ON (FE zgodne z BE) | AI Editor panel widoczny |
| `tabeleFormIntakeFlag` | `src/utils/tabeleFormIntakeFlag.ts` | OFF | JWT form intake niewidoczny |

### Realtime + Presence

Edytor komórek wspiera realtime + presence (karta §1a). Mechanizm weryfikować w DevTools → Network → WS lub `/api/table-platform/*` SSE. `RecordWatchService.ts` zarządza obserwatorami rekordów przez DB (nie czysty WS) — watchers zapisani w `tp_record_watches`, notifikacje przez `notification`-system. [MANUAL]

### E2E zasada (obowiązkowa)

**Każdy test MUSI być potwierdzony w Network DevTools** (filtr `/api/table-platform`). Po akcji odśwież stronę i sprawdź, że stan przetrwał w DB. Sama zmiana w UI = **FAIL**. Szczególnie ważne dla Records API (S1 — DB 100% zmockowany w testach auto) i AI Editor (applyProposal realnie modyfikuje `tp_records`).

### Beta gating

Route `/tabele` = beta closed (`betaAccess.ts`). **Bezpośredni URL omija beta-plate** — API jest org-gated przez `PermissionsService`. Nawet zalogowany user bez dostępu do base dostanie 403/404 z API.

### Role per-base RBAC

`PermissionsService` egzekwuje role na poziomie bazy: `OWNER` / `EDITOR` / `COMMENTER` / `VIEWER` (tabela `tp_base_members`). Zbiory:
- `DATA_WRITE_ROLES` (rekordy) → metoda `canModifyBase`
- `SCHEMA_WRITE_ROLES` (pola/struktura) → `canModifySchema`

---

## Setup środowiska testowego

1. Uruchom dev server: FE `:3000`, BE `:3001`. Upewnij się, że migracje `tp_*` (700–726 + 777–778) są zastosowane — sprawdź `GET /api/table-platform/health` → 200.
2. Zaloguj się jako **OWNER org DBR77** (konto Piotr) — ma pełny dostęp per-base RBAC.
3. Przygotuj drugie konto testowe z rolą **EDITOR** w tej samej org.
4. Przygotuj konto z **innej org** do testów IDOR (sekcja §10.3) — możesz użyć dedykowanego testowego org, NIE produkcyjne dane.
5. DevTools → Network: filtr `/api/table-platform`. Console = 0 błędów to wymóg DoD.
6. Dane testowe (utwórz przed testami):
   - 1 baza testowa „TestBase-M20" z 2 tabelami: „Persons" (pola: Name, Age, Status, Email) i „Projects" (pola: Title, Owner, Deadline, Priority, Budget).
   - Minimum 5 rekordów w „Persons", 3 w „Projects".
   - 1 formularz publiczny z tabeli „Persons".
   - 1 automatyzacja (trigger: record_change, action: webhook) w tabeli „Persons".
7. Weryfikacja flag: `GET /api/table-platform/health` — sprawdź w payloadzie wartości flag lub zweryfikuj w kodzie `FeatureFlags.ts` na dev.
8. Miej przygotowany plik CSV z co najmniej 3 kolumnami i 10 wierszami do testów importu.

---

## §1. Records API — podstawowy CRUD

> **Scenariusz krytyczny S1** (karta §0). Uwaga: testy automatyczne mają DB 100% zmockowaną — te testy manualne to jedyne prawdziwe dowody trwałości rekordów.

### 1.1 GET /tables/:tableId/records — lista z paginacją

**Endpoint:** `GET /api/table-platform/tables/:tableId/records`
**Guard:** `requireTableAccess` → `canAccessBase`

- [ ] Wejdź na tabelę „Persons". W Network sprawdź żądanie `GET /api/table-platform/tables/{tableId}/records`.
- [ ] **Response structure:** `{ records: [...], total: N, page: 1, pageSize: 50 }` (lub analogiczne). Sprawdź typy pól: `id` (string UUID), `table_id`, `data` (JSON object), `created_at`, `created_by`.
- [ ] Paginacja: dodaj `?page=2&pageSize=2` do URL lub sprawdź, czy UI ma „Load more"/infinite scroll. Sprawdź, że zwrócono odpowiedni podzbiór.
- [ ] Filtr: jeśli UI pozwala filtrować (widok Grid z filtrem) — w Network sprawdź dodatkowe query params (`filter=...`).
- [ ] **[DB]** Zapytaj DB: `SELECT count(*) FROM tp_records WHERE table_id = '<tableId>'` i porównaj z `total` w response.
- [ ] **Edge:** próba dostępu do tabeli innej org → 403/404 z `{ error: 'Access denied' }`.
- [ ] **Edge:** `tableId` nieistniejący → 404.

### 1.2 POST /tables/:tableId/records — tworzenie rekordu

**Endpoint:** `POST /api/table-platform/tables/:tableId/records`
**Guard:** `requireTableAccess` + `canModifyBase` (DATA_WRITE_ROLES)

- [ ] Utwórz nowy rekord w UI (przycisk „+" / „New row" w gridzie). Wypełnij pola Name i Age.
- [ ] **Network:** `POST .../records`, body `{ data: { Name: "...", Age: 42 }, ... }`, response 201 `{ id: "uuid", ... }`.
- [ ] **[DB]** Sprawdź: `SELECT * FROM tp_records WHERE id = '<zwrócone id>'` — rekord istnieje, `data` = jsonb z wprowadzonymi wartościami.
- [ ] Odśwież stronę → rekord nadal widoczny (trwałość `tp_*`, nie in-memory).
- [ ] **Edge:** brak wymaganego pola (jeśli tabela ma walidacje) → 400 z opisem błędu.
- [ ] **Edge:** próba created jako VIEWER → 403.

### 1.3 GET /records/:recordId — pojedynczy rekord

**Endpoint:** `GET /api/table-platform/records/:recordId`
**Guard:** `requireRecordAccess`

- [ ] Klik na rekord → otwarcie panelu detalu lub modal rekordu.
- [ ] **Network:** `GET .../records/{recordId}`, response 200 z pełnym obiektem rekordu.
- [ ] Sprawdź, że zwrócony `table_id` zgadza się z oczekiwaną tabelą.
- [ ] **Edge:** `recordId` nieistniejący → 404.
- [ ] **Edge:** rekord z innej org → 403/404.

### 1.4 PATCH /records/:recordId — częściowa edycja

**Endpoint:** `PATCH /api/table-platform/records/:recordId`
**Guard:** `requireRecordAccess` + `canModifyBase`

- [ ] Edytuj komórkę inline w gridzie (klik na komórkę → enter wartości → zatwierdź).
- [ ] **Network:** `PATCH .../records/{recordId}`, body `{ data: { fieldName: "nowa wartość" } }`, response 200 z zaktualizowanym rekordem.
- [ ] **[DB]** Sprawdź: `SELECT data FROM tp_records WHERE id = '<recordId>'` → jsonb zawiera zmienione pole.
- [ ] Odśwież stronę → zmiana przetrwała.
- [ ] **Edge:** próba edycji przez COMMENTER/VIEWER → 403.

### 1.5 PUT /records/:recordId — pełna edycja

Jeśli BE obsługuje PUT (pełna podmiana `data`):

- [ ] Wyślij `PUT .../records/{recordId}` z pełnym obiektem `data` (Postman/DevTools XHR override lub UI jeśli dostępne).
- [ ] **Network:** response 200, `data` całkowicie zastąpione.
- [ ] **[DB]** Sprawdź `data` w tabeli — żadne poprzednie pola nie zostały.

### 1.6 DELETE /records/:recordId — usunięcie rekordu

**Endpoint:** `DELETE /api/table-platform/records/:recordId`
**Guard:** `requireRecordAccess` + `canModifyBase`

- [ ] Usuń rekord w UI (menu kontekstowe → „Delete row").
- [ ] **Network:** `DELETE .../records/{recordId}`, response 204 (no content).
- [ ] **[DB]** Sprawdź: `SELECT * FROM tp_records WHERE id = '<recordId>'` → 0 wierszy.
- [ ] Odśwież stronę → rekord zniknął.
- [ ] **Edge:** podwójne DELETE tego samego ID → 404.
- [ ] **Edge:** próba DELETE jako VIEWER → 403.

### 1.7 Bulk operations — wsadowe operacje

**Endpointy:** `POST /api/table-platform/records/bulk-create`, `POST /records/bulk-update`, `POST /records/bulk-delete` (szukaj w routes ~l.1078-1185)

- [ ] Zaznacz wiele rekordów w UI (shift+klik / checkbox) → „Delete selected".
- [ ] **Network:** żądanie wsadowe lub sekwencja DELETE — zidentyfikuj wzorzec.
- [ ] **[DB]** Sprawdź, że wszystkie zaznaczone rekordy znikły z `tp_records`.
- [ ] Bulk create: import CSV `POST /bases/:baseId/import/csv` → sprawdź liczbę wierszy w DB.
- [ ] **Edge:** batch z częściowo niepoprawnym rekordem → czy transakcja odpada całość, czy partial success?

### 1.8 Display names

**Endpoint:** `POST /api/table-platform/records/display-names` (~l.2536)

- [ ] W UI sprawdź, czy rekordy mają wyświetlane nazwy (linked records pokazują etykietę zamiast UUID).
- [ ] **Network:** `POST .../records/display-names`, body `{ recordIds: [...] }`, response `{ [id]: "label" }`.

---

## §2. Bazy i tabele — zarządzanie

> **INV_E poz. 4:** Workspaces/bazy/tabele CRUD, duplicate, search, CSV import, audit, attachments, display-names.

### 2.1 Tworzenie bazy (base)

**Endpoint:** `POST /api/table-platform/bases` (~l.356)

- [ ] UI: przycisk „New base" lub odpowiednik. Podaj nazwę „TestBase-Tworzenie".
- [ ] **Network:** `POST .../bases`, body `{ name: "...", organizationId: "..." }`, response 201 `{ id, name, organization_id, created_at }`.
- [ ] **[DB]** Sprawdź: `SELECT * FROM tp_bases WHERE name = 'TestBase-Tworzenie'` → wiersz istnieje, `organization_id` = org Piotra.
- [ ] Odśwież stronę → baza widoczna.
- [ ] **Edge:** baza bez nazwy → 400.

### 2.2 Edycja i usunięcie bazy

**Endpointy:** `PATCH /bases/:baseId` (~l.417), `DELETE /bases/:baseId` (~l.435)

- [ ] Zmień nazwę bazy → **Network:** `PATCH .../bases/{baseId}`, body `{ name: "..." }`, response 200.
- [ ] **[DB]** Sprawdź zaktualizowaną nazwę.
- [ ] Duplikacja bazy: `POST /bases/:baseId/duplicate` (~l.469) → nowa baza z kopiami tabel i schematów. **[DB]** Sprawdź `tp_bases` + `tp_tables`.
- [ ] Usuń bazę → **Network:** `DELETE .../bases/{baseId}`, response 204. **[DB]** sprawdź kaskadę: `tp_tables`, `tp_fields`, `tp_records` z tej bazy = 0 wierszy.
- [ ] **Edge:** usunięcie bazy z rekordami — potwierdzenie dialogowe wymagane; jeśli brak potwierdzenia, sprawdź, czy jest.

### 2.3 Tworzenie tabeli

**Endpoint:** `POST /workspaces/:workspaceId/tables` lub `POST /bases/:baseId/tables` (~l.527)

- [ ] UI: w bazie „+" → „New table". Podaj nazwę „TestTable-Schemat".
- [ ] **Network:** POST, body `{ name: "...", baseId: "..." }`, response 201 `{ id, name, base_id }`.
- [ ] **[DB]** `SELECT * FROM tp_tables WHERE name = 'TestTable-Schemat'` → 1 wiersz.

### 2.4 Edycja schematu — dodawanie kolumny

**Endpoint:** `POST /tables/:tableId/fields` (~l.619)

- [ ] Klik „+" kolumny w gridzie → wybierz typ „number" → „Budget". Potwierdź.
- [ ] **Network:** `POST .../tables/{tableId}/fields`, body `{ name: "Budget", field_type: "number", options: {} }`, response 201.
- [ ] **[DB]** `SELECT * FROM tp_fields WHERE table_id = '<tableId>' AND name = 'Budget'` → 1 wiersz.

### 2.5 Pełna lista typów kolumn (zidentyfikowana z kodu)

`SchemaValidationService.ts` definiuje `ALLOWED_FIELD_TYPES`:

```
singleLineText, longText, number, currency, percent, checkbox,
date, datetime, user, singleSelect, multiSelect, url, email,
phone, attachment, linkedRecord, count, lookup, rollup,
createdTime, createdBy, lastModifiedTime, lastModifiedBy,
autoNumber, formula, button, rating, duration, barcode,
risk_score, priority, ai_generated_summary, ai_classification,
source_reference
```
(35 typów łącznie z EPIC-T7 specialized types)

- [ ] Dla minimum 8 typów (obowiązkowo: `singleLineText`, `number`, `checkbox`, `date`, `singleSelect`, `multiSelect`, `linkedRecord`, `formula`) utwórz kolumnę przez UI.
- [ ] Każda: **Network** weryfikacja + **[DB]** `SELECT field_type FROM tp_fields WHERE name = '...'`.
- [ ] Typy auto (createdTime, autoNumber, lastModifiedTime, createdBy, lastModifiedBy) — sprawdź, że kolumna wypełnia się automatycznie po tworzeniu rekordu i **blokuje ręczne nadpisanie**.
- [ ] Typy specialized (risk_score, priority, ai_generated_summary, ai_classification, source_reference) — [FLAG] sprawdź validator: np. `risk_score` akceptuje tylko skale 3/5/25; `priority` akceptuje zdefiniowane presety (P0/P1/P2/P3 lub critical/high/medium/low).

### 2.6 Zmiana typu kolumny

**Endpoint:** `PATCH /tables/:tableId/fields/:fieldId` (~l.677) lub `changeFieldType` (~l.712)

- [ ] Zmień typ kolumny „Age" z `number` na `singleLineText`.
- [ ] **Network:** `PATCH .../fields/{fieldId}`, body `{ field_type: "singleLineText" }`, response 200.
- [ ] **[DB]** Sprawdź zaktualizowany `field_type` + istniejące dane (konwersja: `42` → `"42"`?).
- [ ] **Edge:** zmiana na typ niekompatybilny (e.g., `linkedRecord` bez konfiguracji) → 400 z opisem.

### 2.7 Usunięcie kolumny

**Endpoint:** `DELETE /tables/:tableId/fields/:fieldId` (~l.655 lub ~l.836)

- [ ] Usuń kolumnę „Age" (lub testową). Potwierdzenie dialogowe.
- [ ] **Network:** DELETE, response 204.
- [ ] **[DB]** `SELECT * FROM tp_fields WHERE id = '<fieldId>'` → 0 wierszy. Sprawdź, że dane w `tp_records.data` dla tej kolumny nie powodują błędów (orphan cleanup).

### 2.8 Usunięcie tabeli

**Endpoint:** `DELETE /tables/:tableId` (~l.655 lub ~l.581)

- [ ] Usuń tabelę z bazy. Potwierdzenie dialogowe (powinno ostrzegać o utracie rekordów).
- [ ] **Network:** DELETE, response 204.
- [ ] **[DB]** `tp_tables`, `tp_fields`, `tp_records` dla tej tabeli = 0 wierszy. Kaskada działa.

### 2.9 Reorder pól

**Endpoint:** `POST /tables/:tableId/fields/reorder` (~l.5168)

- [ ] Przeciągnij kolumnę w gridzie na inną pozycję. [MANUAL]
- [ ] **Network:** `POST .../fields/reorder`, body `{ fieldIds: [...] }`, response 200.
- [ ] **[DB]** Sprawdź `field_order` w `tp_fields` — kolejność zmieniona.

### 2.10 Import CSV

**Endpoint:** `POST /bases/:baseId/import/csv` (~l.1505)

- [ ] Użyj przycisku importu CSV. Wybierz przygotowany plik (10 wierszy, 3 kolumny).
- [ ] **Network:** `POST .../import/csv`, content-type multipart/form-data, response 200/201 `{ importedRows: N, ... }`.
- [ ] **[DB]** `SELECT count(*) FROM tp_records WHERE table_id = '<nowej tabeli>'` = 10.
- [ ] **Edge:** CSV z brakującymi nagłówkami → komunikat błędu.

---

## §3. Widoki

> **INV_E poz. 5:** widoki Grid/Kanban/Calendar/Matrix + share + PublicViewPage.

### 3.1 Grid View — główny widok edytowalny

**Endpoint:** `GET /api/table-platform/views` + dane przez `GET /tables/:tableId/records`

- [ ] Otwórz tabelę „Persons" → domyślny Grid View.
- [ ] Inline edit komórki: klik → F2 lub podwójny klik → wpisz → Enter. Zapis automatyczny.
- [ ] **Network:** `PATCH .../records/{id}`, body zmienionego pola, response 200.
- [ ] Kolumny: zmień szerokość kolumny `PATCH /views/:viewId/columns` (~l.2374) — sprawdź Network.
- [ ] Frozen columns: jeśli UI pozwala (prawy klik na nagłówek kolumny → „Freeze") → sprawdź Network/payload.
- [ ] Keyboard navigation: Tab (następna komórka), Shift+Tab (poprzednia), Enter (dół), Escape (anuluj). [MANUAL]
- [ ] Sortowanie kolumny: klik na nagłówek → A→Z/Z→A. **Network:** query param `sort[field]=...&sort[dir]=asc`.
- [ ] **Edge:** zmiana komórki + Escape przed zatwierdzeniem → wartość nie zapisana (sprawdź Network — brak żądania PATCH).

### 3.2 Galeria / Kanban View

**Endpoint:** `POST /views/:viewId/configure` lub widok per-endpoint

- [ ] Przełącz na widok Kanban (jeśli dostępny — pole `singleSelect` lub `status` jako kolumna).
- [ ] **Network:** zmiana widoku = zmiana parametru w URL lub `GET /tables/:tableId/records?viewId=...`.
- [ ] Przesuń kartę między kolumnami Kanban. [MANUAL]
- [ ] **Network:** `PATCH .../records/{id}`, body zaktualizowanego pola statusu, response 200.
- [ ] **[DB]** Sprawdź zmianę w `tp_records.data`.

### 3.3 Calendar View

- [ ] Przełącz na widok kalendarza (wymaga pola `date` lub `datetime` w tabeli).
- [ ] Rekordy z datą pojawiają się w odpowiednim miejscu kalendarza.
- [ ] Przeciągnij rekord na inną datę. [MANUAL]
- [ ] **Network:** `PATCH .../records/{id}`, body zmienionej daty, response 200.
- [ ] **Edge:** tabela bez pola `date` → komunikat „Add a date field to use Calendar view".

### 3.4 Matrix View

- [ ] Przełącz na Matrix (jeśli dostępny). Sprawdź, że renderuje się bez błędów w Console.
- [ ] **Network:** odpowiedni GET records z parametrami widoku.

### 3.5 Tworzenie i zarządzanie widokiem

**Endpointy:** `POST /tables/:tableId/views` (~l.2253), `PATCH /views/:viewId` (~l.2303), `DELETE /views/:viewId` (~l.2473)

- [ ] Utwórz nowy widok: „Filtered View — Active". Dodaj filtr: `Status = 'active'`.
- [ ] **Network:** `POST .../views`, body `{ name: "...", type: "grid", filters: [...] }`, response 201.
- [ ] **[DB]** `SELECT * FROM tp_views WHERE name = 'Filtered View — Active'` → 1 wiersz.
- [ ] Edytuj filtr → **Network:** `PATCH .../views/{viewId}`.
- [ ] Usuń widok → **Network:** DELETE, 204. Domyślny widok (Grid) nie może być usunięty — sprawdź komunikat błędu.

### 3.6 Filtrowanie i sortowanie per widok

**Endpointy:** `PUT /views/:viewId/filters` (~l.2328), `PUT /views/:viewId/sorts` (~l.2351)

- [ ] Dodaj filtr: `Age > 30`. **Network:** `PUT .../views/{viewId}/filters`, body `{ filters: [{ fieldId: "...", operator: "gt", value: "30" }] }`.
- [ ] Lista rekordów w widoku ograniczona do Age > 30. **[DB]** Sprawdź ręcznie na DB.
- [ ] Sortowanie: `Name ASC`. **Network:** `PUT .../views/{viewId}/sorts`.
- [ ] **Edge:** filtr na polu usuniętym → 400 lub graceful fallback.

### 3.7 Share widoku

**Endpointy:** `POST /views/:viewId/share` (~l.3895), `POST /views/:viewId/unshare` (~l.3907)

- [ ] Klik „Share view" → UI generuje link. **Network:** `POST .../views/{viewId}/share`, response `{ shareToken: "...", shareUrl: "..." }`.
- [ ] Otwórz link w trybie incognito (bez zalogowania). **[MANUAL]** Sprawdź `PublicViewPage` — tabela widoczna read-only (brak edycji komórek).
- [ ] Revoke: klik „Unshare". **Network:** `POST .../views/{viewId}/unshare`, response 200. Link przestaje działać → 404.
- [ ] **[DB]** Sprawdź kolumnę `share_token` w `tp_views` — NULL po unshare.
- [ ] share_password: ustaw hasło na widoku (jeśli UI pozwala). **Edge (bug P2 znany z karty §6):** link chroni hasłem? Sprawdź `MetadataService.ts:1279` — hasło zapisywane, ale NIE weryfikowane. **Oczekiwany stan:** FAIL — widok otwiera się bez hasła. Odnotuj jako known bug L-03.

### 3.8 PublicViewPage — stany UI (i18n bug)

**Known bug L-09 z karty:** PublicViewPage EN-only (`'Failed to load shared view'` hardkod).

- [ ] Otwórz share link w trybie incognito (PL browser / Accept-Language: pl). Zmień język przeglądarki na PL.
- [ ] Sprawdź komunikaty błędów (np. błędny URL) — czy są po polsku? Oczekiwane: EN-only (known bug L-09).
- [ ] Stany: pusty (brak rekordów), ładowanie, błąd (nieprawidłowy token), brak uprawnień — czy każdy ma komunikat (nie pustą stronę)?
- [ ] **Edge:** token wygasły/revoked → 404 z komunikatem.

---

## §4. Formuły v2

> **INV_E poz. 6:** FormulaEditor + FormulaEngineV2, linked records, rollupy.

### 4.1 Typy formuł (FormulaEngineV2)

Zidentyfikowane z kodu (`ViewQueryEngine.ts`, `SchemaValidationService.ts`): pola `formula`, `rollup`, `lookup`, `count`, `linkedRecord`.

- [ ] Utwórz kolumnę `formula` o nazwie „FullName" z wyrażeniem `{Name} & " " & {Status}`.
- [ ] **Network:** `POST .../fields`, body `{ field_type: "formula", options: { formula: "{Name} & \" \" & {Status}" } }`, response 201.
- [ ] Sprawdź, że komórki `FullName` są wypełnione automatycznie na podstawie innych pól.
- [ ] **[DB]** `SELECT data FROM tp_records WHERE table_id = '<tableId>' LIMIT 1` — pole `FullName` przeliczone (lub widok zwraca `computed_fields`?).

### 4.2 Edytor formuł — autocomplete i walidacja

- [ ] Otwórz edytor formuł (klik na pole formula → edytuj). Autocomplete nazw pól przy wpisaniu `{N` → lista pól.
- [ ] Wpisz błędną formułę: `{NonExistent}` → komunikat walidacji: „Field 'NonExistent' not found".
- [ ] Formuła z błędem typów: `{Name} + {Age}` (tekst + liczba) → walidacja lub graceful runtime error.
- [ ] **Zapis:** zatwierdź formułę → **Network:** PATCH lub POST, response 200/201.

### 4.3 Zależności cykliczne — walidacja

- [ ] Utwórz formułę A odwołującą się do B i formułę B odwołującą się do A.
- [ ] **Oczekiwane:** 400 `{ error: "Circular dependency detected" }` lub analogiczne.
- [ ] **[DB]** żaden rekord nie powinien być zaktualizowany przy cyklicznej formule.

### 4.4 Lookup i Rollup

- [ ] Utwórz `linkedRecord` łączące „Persons" z „Projects" (przez pole `Owner`).
- [ ] **Network:** POST field `linkedRecord` z options `{ linkedTableId: "..." }`.
- [ ] Utwórz `rollup` na polu `Budget` z funkcją `SUM`. **Network:** POST field `rollup` z `{ linkedFieldId: "...", aggregation: "SUM" }`.
- [ ] Sprawdź, że rollup oblicza prawidłową sumę dla połączonych rekordów.
- [ ] `lookup` — skopiuj wartość z pola w connected table.
- [ ] `count` — zlicz powiązane rekordy. Sprawdź, że count zmienia się po dodaniu/usunięciu linked record.

### 4.5 Przeliczanie po zmianie danych

- [ ] Zmień wartość pola wejściowego formuły (np. `Name`). Sprawdź, że pole formuły przelicza się automatycznie.
- [ ] **Timing:** czy przeliczanie jest synchroniczne (widoczne natychmiast) czy asynchroniczne (po refresh)?
- [ ] **Network:** szukaj `POST /tables/:tableId/formulas/evaluate` lub analogicznego endpointu przeliczania (~l.3960-3976 lub la. 5064-5168).
- [ ] **[DB]** Po zmianie wartości wejściowej: sprawdź, że `tp_records.data` zawiera zaktualizowaną wartość formuły.

### 4.6 Schema proposals — generacja z czatu [FLAG `ENABLE_V8_GLOBAL`]

**Endpointy:** `POST /schema/propose` (~l.1644-1719), `POST /schema/proposals/:proposalId/execute` (~l.1720-1743), `POST /schema/proposals/:proposalId/reject` (~l.1744-1762)

- [ ] **[FLAG]** `ENABLE_V8_GLOBAL` = OFF (default) → generacja tabeli z czatu jest niedostępna. Sprawdź `GET /api/artifact-runs` → 404. Odnotuj, nie blokuje.
- [ ] Jeśli `ENABLE_V8_GLOBAL = true` w env: w Czacie wyślij „Utwórz tabelę projektów z polami: Title, Owner, Deadline, Budget". **Network:** `POST /api/schema/propose` lub analogiczny. Sprawdź proposal. Execute → `POST .../execute`, response 201. **[DB]** sprawdź nowe `tp_tables` + `tp_fields`.

---

## §5. AI Editor 8 poziomów [FLAG: `ENABLE_TABLE_AI_EDITOR` = BE ON]

> **INV_E poz. 7:** AI Editor (8 poziomów), propose → applyProposal / reject + budżet tokenów.
> **Flagi:** `ENABLE_TABLE_AI_EDITOR` = BE default ON (FeatureFlags.ts:84); `tabeleAiEditorFlag` FE = ON.
> **Uwaga:** poziomy 7 (Methodology) i 8 (Sources) wymagają roli `superAdminOnly`.

### 5.1 Weryfikacja flagi i dostępu do panelu

- [ ] Otwórz tabelę. Sprawdź, że panel AI Editor jest widoczny w prawym szynie (`TabeleRightRail`).
- [ ] **Network:** `GET /api/table-platform/ai-editor/budget?workspaceId=...` → 200 `{ remaining: N, total: N, period: "..." }`.
- [ ] Jeśli `ENABLE_TABLE_AI_EDITOR = false` (symulacja): sprawdź, że endpoint zwraca 404 `{ code: "AI_EDITOR_DISABLED" }` i UI pokazuje komunikat zamiast pustej strony (L-08 = known bug — aktualnie `.catch(()=>null)` = niema pustka).

### 5.2 Poziom 1 — Cell (refine single cell)

**Endpoint:** `POST /api/table-platform/tables/:tableId/ai-editor/propose` body `{ level: "cell", prompt: "...", context: { recordId, fieldId } }`

- [ ] Klik na komórkę → przycisk AI (różdżka/iskra) → „Refine this cell". Wpisz prompt: „Skróć to do 5 słów".
- [ ] **Network:** POST do `ai-editor/propose`, body zawiera `level: "cell"`, response 200 `{ proposalId: "...", diff: [...], tokensUsed: N }`.
- [ ] Panel diff: pokazuje oryginał vs propozycja AI. Klik „Apply" → `POST .../ai-editor/proposals/{proposalId}/apply`.
- [ ] **[DB]** Sprawdź `tp_records.data` dla tego rekordu i pola — wartość zmieniona.
- [ ] Klik „Reject" → `POST .../ai-editor/proposals/{proposalId}/reject`. **[DB]** wartość bez zmian.

### 5.3 Poziom 2 — Record (fill missing fields)

**Endpoint:** body `{ level: "record", ... context: { recordId } }`

- [ ] Utwórz rekord z brakującymi polami (tylko `Name`). Otwórz AI Editor → poziom „Record" → „Fill missing fields".
- [ ] **Network:** POST propose `level: "record"`. Response zawiera propozycje dla brakujących pól.
- [ ] Apply → wszystkie puste pola otrzymują wartości. **[DB]** Weryfikacja.

### 5.4 Poziom 3 — Column (bulk-fill column)

**Endpoint:** body `{ level: "column", context: { fieldId } }`

- [ ] Wybierz kolumnę `Status` → AI Editor → „Bulk-fill column". Prompt: „Przypisz status na podstawie imienia osoby".
- [ ] **Network:** POST propose `level: "column"`. Response diff dla wszystkich rekordów.
- [ ] Apply → zaktualizowane wartości w całej kolumnie. **[DB]** Weryfikacja masowej zmiany.
- [ ] **Uwaga trwałości:** reload strony → wszystkie zmiany przetrwały.

### 5.5 Poziom 4 — Structure (add/rename/retype/drop fields)

**Endpoint:** body `{ level: "structure", ... }`

- [ ] Prompt: „Dodaj pole 'Priority' jako singleSelect z opcjami High/Medium/Low".
- [ ] **Network:** POST propose `level: "structure"`. Diff zawiera operacje na schemacie.
- [ ] Apply → **[DB]** nowe pole w `tp_fields` + opcje w `options` jsonb.

### 5.6 Poziom 5 — View (create/update saved view)

**Endpoint:** body `{ level: "view", ... }`

- [ ] Prompt: „Utwórz widok pokazujący tylko osoby z Priority = High, posortowane po nazwie".
- [ ] **Network:** POST propose `level: "view"`. Diff = konfiguracja nowego widoku.
- [ ] Apply → nowy widok widoczny w selectorze widoków. **[DB]** `tp_views`.

### 5.7 Poziom 6 — Relational (propose linked-record relations)

**Endpoint:** body `{ level: "relational", ... }`

- [ ] Prompt: „Zaproponuj relację między Persons a Projects przez pole Owner".
- [ ] **Network:** POST propose `level: "relational"`. Diff = operacje tworzenia `linkedRecord`.
- [ ] Apply → pole linked record dodane. **[DB]** `tp_fields` z `field_type = 'linkedRecord'`.

### 5.8 Poziom 7 — Methodology [FLAG: `superAdminOnly`]

**Endpoint:** body `{ level: "methodological", ... }`

- [ ] **[FLAG]** Zaloguj jako OWNER (superadmin). Panel AI Editor → poziom „Methodology" widoczny.
- [ ] Prompt: „Sprawdź, czy ta tabela spełnia standardy governance projektu".
- [ ] **Network:** POST propose `level: "methodological"`. Response z flagami deviacji od reguł.
- [ ] **Role test:** zaloguj jako zwykły EDITOR → poziom 7 niewidoczny lub 403 z API. **[DB]** brak propozycji od EDITOR dla tego poziomu.

### 5.9 Poziom 8 — Sources [FLAG: `superAdminOnly`]

**Endpoint:** body `{ level: "source", ... }`

- [ ] **[FLAG]** Zaloguj jako OWNER. AI Editor → „Sources" → prompt: „Zaproponuj źródła dla rekordów bez source_reference".
- [ ] **Network:** POST propose `level: "source"`. Response z propozycjami source_reference.
- [ ] Apply → pola `source_reference` zaktualizowane. **[DB]** Weryfikacja.

### 5.10 Budżet tokenów — AiBudgetExhaustedError

**Endpoint:** `GET /ai-editor/budget?workspaceId=...`

- [ ] Sprawdź budżet przed i po serii wywołań AI Editor. **Network:** GET budget.
- [ ] Jeśli możliwe: wyczerpaj budżet (lub zasymuluj, ustawiając `remaining=0` w dev). **Oczekiwane:** next propose → 429 `{ code: "AI_BUDGET_EXHAUSTED" }`.
- [ ] UI po 429: komunikat „AI Editor: budget exhausted" zamiast niemy błąd. Sprawdź Console — brak uncaught exception.

---

## §6. Realtime + Presence

> **INV_E poz. 6:** realtime + presence. Mechanizm: `RecordWatchService` (DB-backed watchers) + notification system.

### 6.1 Presence — kto edytuje tabelę [MANUAL]

- [ ] Otwórz tę samą tabelę w dwóch zakładkach / dwóch różnych kontach.
- [ ] W pierwszej zakładce: wejdź w tryb edycji komórki.
- [ ] W drugiej zakładce: sprawdź, czy widoczny jest wskaźnik obecności (np. awatar, kolorowy kursor, podświetlona komórka). [MANUAL]
- [ ] **Network (pierwsza zakładka):** szukaj żądania `POST .../records/{id}/watch` lub WebSocket/SSE, który broadcastuje obecność.
- [ ] Obecność znika po wyjściu z trybu edycji / zamknięciu zakładki.

### 6.2 Realtime updates — zmiana widoczna u innego usera [MANUAL]

- [ ] Dwie zakładki (lub dwa konta). Konto A edytuje komórkę „Name" rekordu #1 → zatwierdza.
- [ ] **Konto B (bez odświeżania strony):** zmiana powinna pojawić się automatycznie w ciągu ~2s.
- [ ] Jeśli mechanizm = polling: zidentyfikuj interwał i udokumentuj (nie WebSocket).
- [ ] Jeśli WebSocket: DevTools → Network → WS → sprawdź wiadomość `{ type: "record_updated", recordId: "...", data: {...} }`.
- [ ] **[DB]** Zmiana persystuje po reload.

### 6.3 Conflict resolution — dwie edycje tej samej komórki [MANUAL]

- [ ] Konto A i Konto B jednocześnie edytują tę samą komórkę (wchodząc w inline edit).
- [ ] Konto A zatwierdza pierwsze, Konto B zatwierdza drugie.
- [ ] **Oczekiwany wynik:** last-write-wins (wersja Konta B). Sprawdź `updated_at` w DB.
- [ ] Czy jest komunikat konfliktu dla Konta A? Sprawdź, czy UI informuje o nadpisaniu.
- [ ] Brak crash, brak niespójnego stanu w `tp_records`.

### 6.4 Disconnect / reconnect [MANUAL]

- [ ] Edytuj komórkę → wyłącz sieć (DevTools → Network → Offline) → spróbuj zatwierdzić.
- [ ] **Oczekiwane:** UI informuje o błędzie sieci (toast, komunikat), żądanie nie traci danych.
- [ ] Włącz sieć ponownie → sprawdź, czy jest mechanizm retry lub czy user musi ponownie zatwierdzić.
- [ ] **[DB]** Sprawdź, że żadna częściowa zmiana nie trafiła do bazy podczas offline.

### 6.5 RecordWatchService — obserwowanie rekordu

**Endpointy:** szukaj `POST /records/:recordId/watch`, `DELETE /records/:recordId/watch` w routes

- [ ] Klik „Watch record" (jeśli UI dostępne). **Network:** POST watch.
- [ ] **[DB]** `SELECT * FROM tp_record_watches WHERE record_id = '<id>' AND user_id = '<userId>'` → 1 wiersz.
- [ ] Inny user edytuje ten rekord → watcher dostaje powiadomienie (sprawdź Inbox / notification system).
- [ ] Unwatch → DELETE. **[DB]** wiersz usunięty.

---

## §7. Automatyzacje

> **INV_E poz. 12:** automatyzacje — toggle/delete/runs/run-now/validate-cron + ScheduledAutomationExecutor.

### 7.1 Tworzenie automatyzacji

**Endpoint:** `POST /tables/:tableId/automations` (~l.2841), body: `{ name, triggerType, triggerConfig, actions, baseId }`

- [ ] UI: „Automations" → „New automation". Nazwa: „Notify on Status Change". Trigger: `record_changed`, Config: `{ field: "Status" }`. Action: webhook URL `https://webhook.site/...`.
- [ ] **Network:** POST, response 201 `{ id, name, triggerType, actions, enabled: true }`.
- [ ] **[DB]** `SELECT * FROM tp_automations WHERE name = 'Notify on Status Change'` → 1 wiersz.

### 7.2 Lista automatyzacji i toggle

**Endpointy:** `GET /tables/:tableId/automations` (~l.2873), `PATCH /automations/:automationId/toggle` (~l.2888)

- [ ] Lista automatyzacji widoczna w UI.
- [ ] **Network:** `GET .../automations` → lista z `{ id, name, triggerType, enabled }`.
- [ ] Toggle wyłącz: `PATCH .../toggle`, body `{ enabled: false }`, response `{ success: true, enabled: false }`.
- [ ] **[DB]** `SELECT enabled FROM tp_automations WHERE id = '...'` → false.

### 7.3 Typy triggerów

Z kodu (`createAutomation` accept `triggerType: string`):
- `record_changed` — zmiana rekordu
- `record_created` — nowy rekord
- `cron` — harmonogram (validate-cron endpoint)
- `webhook` — zewnętrzne żądanie HTTP

- [ ] Utwórz automatyzację z triggerem `cron`: express: `*/5 * * * *` (co 5 min).
- [ ] **Walidacja cron:** `POST /automations/validate-cron` (~l.2974), body `{ expression: "*/5 * * * *" }` → response 200 `{ valid: true, nextRun: "..." }`.
- [ ] **Edge:** nieprawidłowy cron `"* * * * * * *"` → 400 `{ valid: false, error: "..." }`.

### 7.4 Run Now

**Endpoint:** `POST /automations/:automationId/run-now` (~l.2957)

- [ ] Klik „Run now" na istniejącej automatyzacji.
- [ ] **Network:** POST, response 200 `{ runId: "...", status: "running" }` lub `{ status: "success" }`.
- [ ] **[DB]** `SELECT * FROM tp_automation_runs WHERE automation_id = '<id>' ORDER BY created_at DESC LIMIT 1` → nowy run.

### 7.5 Historia wywołań i Next Run

**Endpointy:** `GET /automations/:automationId/runs` (~l.2913), `GET /automations/:automationId/next-run` (~l.2925)

- [ ] UI: otwórz panel automatyzacji → zakładka „History".
- [ ] **Network:** GET runs → `[{ id, status, startedAt, finishedAt, output }]`.
- [ ] Next-run: `GET .../next-run` → `{ nextRun: "ISO-datetime" }`.
- [ ] Sprawdź status run: `success` / `failed` / `running`. Dla failed: czy `output` zawiera opis błędu?

### 7.6 Trigger webhook automation

**Endpoint:** `POST /automations/:automationId/trigger` (~l.2998)

- [ ] Wyślij żądanie wyzwalające automatyzację przez jej webhook URL (zewnętrzne). [MANUAL]
- [ ] Lub bezpośrednio `POST .../trigger` jeśli endpoint jest dostępny.
- [ ] **[DB]** nowy run w `tp_automation_runs`.

### 7.7 Usunięcie automatyzacji

**Endpoint:** `DELETE /automations/:automationId` (~l.2902)

- [ ] Usuń automatyzację. **Network:** DELETE, 204. **[DB]** Sprawdź kaskadę: `tp_automation_runs` dla tej automatyzacji usunięte lub orphaned.

---

## §8. Formularze publiczne

> **INV_E poz. 11:** FormBuilder, publiczny slug router, submissions; wariant JWT per-odbiorca default OFF.

### 8.1 Tworzenie formularza

**Endpoint:** `POST /tables/:tableId/forms` (~l.2726), `requireTableAccess`

- [ ] UI: zakładka „Forms" w tabeli → „New form". Nazwa: „Ankieta kontaktowa". Wybierz pola: Name, Email, Status.
- [ ] **Network:** POST, body `{ name: "...", fields: [...], tableId: "..." }`, response 201 `{ id, slug, url }`.
- [ ] **[DB]** `SELECT * FROM tp_forms WHERE table_id = '<tableId>'` → 1 wiersz ze slugiem.

### 8.2 Lista i edycja formularza

**Endpointy:** `GET /tables/:tableId/forms` (~l.2751), `GET /forms/:formId` (~l.2763), `PATCH /forms/:formId` (~l.2775)

- [ ] Lista formularzy w tabeli. **Network:** GET → `[{ id, name, slug, enabled }]`.
- [ ] Edycja: zmień tytuł formularza. **Network:** PATCH, response 200. **[DB]** Zaktualizowany `name`.

### 8.3 Wypełnienie formularza przez zewnętrznego usera

**Endpoint:** `GET /api/public/table-form/:slug` + `POST /api/public/table-form/:slug/submit` (form-public.routes.ts)

- [ ] Otwórz URL formularza w **trybie incognito** (bez zalogowania). [MANUAL]
- [ ] Formularz renderuje się z polami Name, Email, Status.
- [ ] Wypełnij i klik „Submit". **Network (incognito):** `POST /api/public/table-form/{slug}/submit`, body `{ data: { Name: "...", Email: "..." } }`, response 201.
- [ ] **[DB]** `SELECT * FROM tp_form_submissions WHERE form_id = '<formId>'` → nowy wiersz. `SELECT * FROM tp_records WHERE table_id = '<tableId>'` → nowy rekord z danymi formularza.
- [ ] **Edge:** wypełnienie wymaganego pola puste → 400 z opisem.
- [ ] **Edge:** nieprawidłowy email w polu email → walidacja po stronie FE i/lub BE.

### 8.4 Podgląd submissji w tabeli

**Endpoint:** `GET /forms/:formId/submissions` (~l.2806) — guard naprawiony przez `e9c6cb9c0a` (`:2824`)

- [ ] UI: otwórz formularz → zakładka „Submissions". Lista zgłoszeń.
- [ ] **Network:** `GET .../forms/{formId}/submissions`, response `[{ id, form_id, data, created_at }]`.
- [ ] **Bezpieczeństwo (fix IDOR L-01 naprawiony):** zaloguj jako user z **innej org**. Próba `GET /api/table-platform/forms/{formId}/submissions` gdzie `formId` należy do pierwszej org → **Oczekiwane 403/404**. **[DB]** żadne dane nie wyciekły.

### 8.5 Usunięcie formularza

**Endpoint:** `DELETE /forms/:formId` (~l.2793)

- [ ] Usuń formularz. **Network:** DELETE, 204. **[DB]** wiersz usunięty. Sprawdź, czy publiczny URL przestaje działać (→ 404).

### 8.6 JWT Form Intake [FLAG: `ENABLE_TABLE_FORM_INTAKE_JWT` = OFF]

- [ ] **[FLAG]** default OFF. Sprawdź, że UI nie pokazuje opcji „JWT per-recipient links".
- [ ] Bezpośrednie `POST /api/table-platform/forms/{formId}/jwt-invite` lub analogiczne → 404 lub 503. Odnotuj bez blokowania.

---

## §9. Governed Models

> **INV_E poz. 13:** governed models (KPI/publish-to-results/sync-to-finance), SCIM/SSO.
> **Uwaga krytyczna:** governed sync = STUB (DP-6 preview). `ModuleSyncService.syncToModule:57-110` pisze tylko wiersz-log do `tp_module_sync_results`, NIE do Results/Finance/Execution. Przyciski sync powinny być ukryte lub oznaczone „preview".

### 9.1 Tworzenie governed model

**Endpoint:** `POST /bases/:baseId/governed-models` (~l.3159)

- [ ] UI: menu bazy → „Governed Models" → „New model". Nazwa: „KPI-Persons".
- [ ] **Network:** POST, body `{ name: "...", description: "...", baseId: "..." }`, response 201 `{ id, name }`.
- [ ] **[DB]** `SELECT * FROM tp_governed_models WHERE name = 'KPI-Persons'` → 1 wiersz.

### 9.2 KPI na modelu

**Endpointy:** `POST /governed-models/:modelId/kpis` (~l.3247), `GET /governed-models/:modelId/kpis` (~l.3287), `DELETE /kpis/:kpiId` (~l.3300)

- [ ] Dodaj KPI: nazwa „Average Age", wyrażenie/formula `AVG({Age})`.
- [ ] **Network:** POST kpi, response 201. Lista KPI → GET.
- [ ] **[DB]** odpowiednia tabela KPI z `model_id`.
- [ ] Compute KPI: `POST /kpis/:kpiId/compute` (~l.3413) → response z obliczoną wartością.

### 9.3 Dimensions i Sources

**Endpointy:** `POST/GET/DELETE /governed-models/:modelId/dimensions` (~l.3314-3348), `POST/GET /governed-models/:modelId/sources` (~l.3362-3383), `PATCH /model-sources/:id/trust` (~l.3396)

- [ ] Dodaj dimension „Status". **Network:** POST, 201. **[DB]** Weryfikacja.
- [ ] Dodaj source (link do tabeli danych). PATCH trust (ustaw `trusted: true`). **Network:** PATCH, 200.

### 9.4 Publish to Results [STUB — DP-6 preview]

**Endpoint:** `POST /governed-models/:modelId/publish-to-results` (~l.3430) — guard naprawiony przez `e9c6cb9c0a` (`:3441`)

- [ ] Klik „Publish to Results" (jeśli przycisk widoczny — powinien być ukryty lub oznaczony „preview" per DP-6).
- [ ] **Network:** POST → response `{ success: true }`.
- [ ] **WERYFIKACJA STUB:** sprawdź, że w module M15 Rezultaty BRAK nowej pozycji. **[DB]** tylko `tp_module_sync_results` ma nowy wiersz — ZERO wpisów w tabelach Results. To jest oczekiwane (STUB).
- [ ] **Bezpieczeństwo:** zaloguj jako innej org user → `POST .../publish-to-results` dla modelu innej org → **Oczekiwane 403** (naprawiony fix `e9c6cb9c0a`).

### 9.5 Sync to Finance i Sync to Execution [STUB — DP-6 preview]

**Endpointy:** `POST /governed-models/:modelId/sync-to-finance` (~l.3462), `POST /governed-models/:modelId/sync-to-execution` (~l.3496)

- [ ] Analogicznie do 9.4 — wywołaj, sprawdź `success: true`, **zweryfikuj STUB**: M16 Finanse i M14 Wdrożenie NIE mają nowych danych. Tylko `tp_module_sync_results` ma log.
- [ ] **Link status:** `GET /governed-models/:modelId/link-status` (~l.3563) → response pokazuje aktualne powiązania.

### 9.6 Bezpieczeństwo governed-models (IDOR naprawiony) [DB]

- [ ] Zaloguj jako user z **innej org**. Wywołaj `GET /api/table-platform/governed-models/{modelId}` gdzie model należy do pierwszej org → **Oczekiwane 403/404**. Sprawdź guard `requireGovernedModelAccess`.
- [ ] Wywołaj `PATCH /governed-models/{modelId}` dla modelu innej org → **Oczekiwane 403**. **[DB]** Żaden rekord nie zmieniony.

---

## §10. Rozjazd flag (KRYTYCZNE)

> **L-06 z karty audytu** — częściowo zamknięte R3: SSOT `FeatureFlags.ts` komentarz=runtime spójne. Stary komentarz wyłącznie w `table-platform.ai-editor.routes.ts:36`. FE flagi QA/SourcePack/Conversions OFF.

### 10.1 Mapa flag i aktualny stan

| Flaga | SSOT (FeatureFlags.ts) | FE default | Oczekiwany stan BE |
|---|---|---|---|
| `ENABLE_TABLE_PLATFORM_RECORDS_API` | ON (`:75`) | N/A | ON — Records API aktywne |
| `ENABLE_TABLE_AI_EDITOR` | ON (`:84`) | ON (`tabeleAiEditorFlag`) | ON — AI Editor aktywny |
| `ENABLE_TABLE_QA_ENGINE` | ON (`:89`) | **OFF** (`tabeleQaFlag`) | ON — QA API żywe, UI ukryte |
| `ENABLE_TABLE_SOURCE_PACK` | ON (`:94`) | **OFF** (`tabeleSourcePackFlag`) | ON — Source Pack API żywe, UI ukryte |
| `ENABLE_TABLE_ARTIFACT_CONVERSION` | ON (`:99`) | **OFF** (`tabeleConversionsFlag`) | ON — Conversion API żywe, UI ukryte |
| `ENABLE_RECORD_PROVENANCE` | **OFF** (`:80`) | N/A | OFF — zgodne |
| `ENABLE_TABLE_FORM_INTAKE_JWT` | **OFF** (`:110`) | OFF | OFF — zgodne |
| `ENABLE_V8_GLOBAL` | **OFF** (`:113`) | N/A | OFF — generacja z czatu martwa |

### 10.2 Stary komentarz w route-header — P3-doc

**Plik:** `server/src/routes/table-platform.ai-editor.routes.ts:36`
Komentarz: „disabled by default until C-S2 lands real handlers"

- [ ] Sprawdź plik l.36 — stary komentarz nadal tam jest (known P3-doc L-06).
- [ ] **Asercja:** SSOT `FeatureFlags.ts:84` mówi „Enabled by default; set …=false to disable". Rozbieżność = dokumentacyjna (nie runtime). Odnotuj: wymaga aktualizacji 1 komentarza w route-header.
- [ ] Nie blokuje testów.

### 10.3 QA Engine — BE ON, FE OFF [FLAG]

**Endpointy:** `POST /tables/:tableId/qa/run` (qa.routes.ts), `GET /tables/:tableId/qa/latest`, `POST /tables/:tableId/qa/suppress`

- [ ] **UI:** sprawdź, że panel QA jest **niewidoczny** (FE flaga OFF). Brak zakładki QA w TabeleRightRail.
- [ ] **Brak błędu w Console** — cicha degradacja, nie crash.
- [ ] **BE API bezpośrednio** (Postman/fetch z tokenem): `POST /api/table-platform/tables/{tableId}/qa/run` → **Oczekiwane 200** (BE flaga ON). Response zawiera QA report.
- [ ] **Symulacja FE flagi ON:** jeśli możliwe (dev override), włącz `tabeleQaFlag`. Sprawdź, że panel QA pojawia się, nie ma błędu.
- [ ] **Edge — cicha degradacja (L-08):** gdy `ENABLE_TABLE_QA_ENGINE = false` (symulacja): `GET /tables/:tableId/qa/latest` → 404 `AI_EDITOR_DISABLED`. UI powinno pokazać baner, nie pustą stronę. Aktualnie `.catch(()=>null)` = niema pustka. Odnotuj jako known bug L-08.

### 10.4 Source Pack — BE ON, FE OFF [FLAG]

**Endpointy:** source-pack.routes.ts — `POST /source-packs`, `POST /source-packs/finalize`, `GET /source-packs/:packId`, `GET /tables/:tableId/source-packs`, `GET /source-packs/:packId/records`, `POST /source-packs/:packId/recommendations`

- [ ] **UI:** Source Pack panel niewidoczny (FE flaga OFF). Brak zakładki/opcji Source Pack.
- [ ] **Brak błędu w Console.**
- [ ] **BE API bezpośrednio:** `POST /api/table-platform/source-packs` z tokenem → **Oczekiwane 200/201** (BE ON).
- [ ] **Edge — flaga ON symulacja:** włącz `tabeleSourcePackFlag`. Panel pojawia się. Utwórz pack. Rekordy z tabeli pojawią się jako source.

### 10.5 Artifact Conversion (Table→Doc/Deck) — BE ON, FE OFF [FLAG]

**Endpointy:** conversion.routes.ts — `POST /tables/:tableId/convert`, `GET /conversions/:conversionId`, `GET /conversions/:conversionId/status`, `GET /conversions/:conversionId/artifact`

- [ ] **UI:** przycisk „Export to Document" / „Export to Deck" niewidoczny (FE flaga OFF).
- [ ] **Brak błędu w Console.**
- [ ] **BE API bezpośrednio:** `POST /api/table-platform/tables/{tableId}/convert`, body `{ targetType: "document", workspaceId: "..." }` → **Oczekiwane 200/202** (BE ON). Materializer `conversionMaterializer.ts` jest realny i idempotentny.
- [ ] **Edge — FE flaga ON:** włącz `tabeleConversionsFlag`. Przycisk konwersji pojawia się. Klik → wybór Document/Deck → Network POST. **[DB]** `artifact_registry` ma nowy wpis.
- [ ] **Idempotencja:** wywołaj konwersję 2x tym samym `tableId` i `workspaceId` → drugie wywołanie zwraca istniejący artefakt (nie tworzy duplikatu).

### 10.6 Record Provenance — BE i FE OFF [FLAG]

**Endpoint:** `ENABLE_RECORD_PROVENANCE = false` (zgodne)

- [ ] **UI:** brak kolumny confidence/validation_status w gridzie. Brak sekcji Provenance w panelu rekordu.
- [ ] **BE API bezpośrednio:** `POST /tables/:tableId/records/:recordId/validation-status` (jeśli endpoint istnieje) → 404 lub 503. Nie powinno crashować.

---

## §ŚCIEŻKI CROSS-MODULE

### CM1. M08 Ideas Table → M20 Tabele Studio

**Mechanizm:** `/my-work/sheets/...` redirect do Ideas Table z `?tpTable=` (INV_E). Ideas Table builder = M08; backend = `tp_*` M20.

- [ ] Utwórz tabelę w M08 Ideas Table (`/my-work/ideas/workspace/table`). Sprawdź, że rekord pojawia się w `tp_records` — ta sama baza danych co M20.
- [ ] Otwórz tę samą tabelę przez URL M20 (`/tabele`). Sprawdź, że dane są spójne.
- [ ] **Network:** zarówno M08 jak M20 korzystają z tych samych endpointów `/api/table-platform/...`.

### CM2. M13 Inicjatywy → M20 (tabela KPI inicjatywy)

- [ ] W M13 Inicjatywy (`/initiatives`): otwórz inicjatywę → zakładka KPI. Sprawdź, czy KPI mogą być połączone z `governed_models` M20.
- [ ] **Network:** szukaj wywołań do `/api/table-platform/governed-models` z kontekstu M13.
- [ ] **[DB]** Sprawdź, czy KPI inicjatywy jest zapisane w `tp_governed_models` lub tylko w tabeli inicjatyw.

### CM3. M20 → M17 Outputs (governed model w rejestrze)

- [ ] Wywołaj `publish-to-results` (§9.4 — STUB). Wejdź do M17 Outputs (`/presentations`).
- [ ] Sprawdź zakładkę „Sheets" — czy tabela M20 pojawia się w rejestrze artefaktów.
- [ ] **Oczekiwane przy STUB:** NIE pojawia się (governed sync = log-only). Odnotuj.
- [ ] Konwersja Table→Deck (§10.5 z FE flag ON): po konwersji artefakt pojawia się w M17 Outputs zakładka „Sheets" lub „Documents". **[DB]** `artifact_registry` ma wpis z `source_type = 'table'`.

### CM4. M20 → M18 Dokumenty (dane z tabeli w dokumencie)

- [ ] Konwersja Table→Document (§10.5, FE flag ON): klik „Export to Document" w M20. **Network:** POST convert. Artefakt w M18 Document Studio. Sprawdź, że zawartość dokumentu odpowiada danym z tabeli.

---

## §11. Mapa epików — pokrycie

| Epik (karta §7) | Story | Testy pokrywające |
|---|---|---|
| **Epik 1 — Bezpieczeństwo (P0/P1)** | S1.1: cross-org IDOR | §8.4, §9.4, §9.6, §10.3 — weryfikacja 403/404 po fix `e9c6cb9c0a` |
| | S1.2: SSO/webhook plaintext (L-02) | §11.1 poniżej |
| | S1.3: share_password (L-03) | §3.7 share_password test |
| **Epik 2 — Front↔back integralność** | S2.1: governed sync preview | §9.4, §9.5 — STUB weryfikacja |
| | S2.2: flagi nie kłamią + banery | §10 całe — flag mapa + degradacja |
| **Epik 3 — Test fundamentu** | S3.1: real `tp_records` | §1 całe — DB weryfikacja po każdym CRUD |
| **Epik 4 — Kanony** | S4.1: grid-canon | §3.1-3.4 — grid UX; D-04 = brak standardu (known gap) |
| | S4.2: i18n PublicViewPage | §3.8 — L-09 known bug EN-only |
| | S4.3: tokeny hex + beta-guard + rate-limit | §12.4 i §12.5 poniżej |

### 11.1 SSO / Webhooks — bezpieczeństwo [FLAG: L-02 otwarta P1]

**Endpointy:** `POST /admin/sso/saml` (~l.4284), `POST /admin/sso/oidc` (~l.4306), `GET /admin/sso` (~l.4334), `PATCH /admin/sso/toggle` (~l.4347)

- [ ] Skonfiguruj SSO SAML (lub OIDC) w panelu admin.
- [ ] **Network:** POST, body z `clientSecret`/SAML cert.
- [ ] **[DB]** `SELECT * FROM tp_sso_configs` — sprawdź, czy `clientSecret` jest przechowywany w plaintext (known P1 L-02 z `SSOService.ts:47-63`). Odnotuj bez naprawiania — L-02 = backlog.
- [ ] Webhooks: `POST /bases/:baseId/webhooks` (~l.4132) — HMAC secret w plaintext w DB? Sprawdź `tp_webhooks`. Odnotuj L-02.

---

## §12. Testy przekrojowe

### 12.1 Flag rozjazd — stary komentarz (P3-doc)

- [ ] Otwórz `server/src/routes/table-platform.ai-editor.routes.ts:36`. Potwierdź stary komentarz „disabled by default". **Asercja:** SSOT w `FeatureFlags.ts:84` jest poprawny. Jest to P3-doc do uspójnienia — nie jest to runtime bug.

### 12.2 Beta gating — nawigacyjne vs API

- [ ] Wejdź na `/tabele` bez zalogowania → redirect do login (lub 401).
- [ ] Zalogowany user z org bez dostępu do żadnej bazy: `/tabele` → pusta lista baz (nie crash, nie pokazuje cudzych baz).
- [ ] Bezpośredni URL do tabeli innej org (`/tabele?baseId=<cudzaOrg>`) → 403/404 z API przy próbie listowania rekordów.
- [ ] **Admin bypass:** admin org ma pełny dostęp do baz swojej org, NIE do cudzej org.

### 12.3 Persistencja po reload

- [ ] Po każdej operacji CRUD (§1-§9): odśwież stronę (F5) i sprawdź, że:
  - Rekordy istnieją (`tp_records` nie in-memory).
  - Automatyzacje aktywne.
  - Formularze dostępne.
  - Widoki zachowane.
  - AI Editor proposals: apply przed reload → zmiany widoczne; reject przed reload → bez zmian.

### 12.4 i18n PL/EN

- [ ] Zmień język aplikacji na PL. Sprawdź UI Tabele Studio: labels, przyciski, komunikaty błędów — czy są po polsku?
- [ ] `TabeleView` ma 37× `t()` — oczekiwane tłumaczenia działają.
- [ ] `PublicViewPage`: zmień na PL → hardkodowane EN (known L-09). Odnotuj.
- [ ] Toast messages po CRUD: po polsku w PL, angielsku w EN.

### 12.5 Dark mode

- [ ] Przełącz motyw na dark mode (jeśli dostępny w ustawieniach). Otwórz `/tabele`.
- [ ] Sprawdź grid data: tekst czytelny (kontrast), nagłówki kolumn widoczne, aktywna komórka podświetlona.
- [ ] 322 hex hardcoded w `GridView`/`CellRenderer` (known L-10 P3) — sprawdź, czy widoczne artefakty (np. hardcoded `#ffffff` na białym tle dark-mode). Odnotuj konkretne miejsca.
- [ ] AI Editor panel — tło, tekst, diff karta — czytelne w dark mode.

### 12.6 A11y — tabela accessible

- [ ] Klawiatura: Tab przechodzi przez komórki gridu, Enter otwiera edycję, Escape anuluje. [MANUAL]
- [ ] Screen reader: nagłówki kolumn mają `role="columnheader"`, komórki `role="gridcell"` lub `role="cell"`.
- [ ] Focus visible: po Tab na przycisk „New row" — focus ring widoczny.
- [ ] Kolorowe statusy (singleSelect opcje z kolorem) — czy kolor nie jest jedynym wskaźnikiem (WCAG 1.4.1)? Sprawdź, czy jest text label obok.
- [ ] AI Editor proposal diff: zmiany oznaczone kolorem I tekstem (nie tylko kolor).

### 12.7 Zero błędów w Console

- [ ] Przejdź przez: lista baz → otwórz bazę → otwórz tabelę → edytuj rekord → otwórz AI Editor → utwórz automatyzację → otwórz formularz publiczny.
- [ ] Console = **0 błędów**, 0 uncaught exceptions, 0 unhandled promise rejections.
- [ ] Szczególnie: brak błędu `Cannot read properties of null` po `.catch(()=>null)` w `TabeleView.tsx:122,171,361` (known L-08 — cicha degradacja flag-OFF nie powinna generować uncaught).

### 12.8 Schema readiness — 503 test

- [ ] Jeśli możliwe na dev: wyłącz aplikację i usuń migracje `tp_*`. Uruchom ponownie. `GET /api/table-platform/health` → sprawdź status. Wywołaj `GET /tables/:tableId/records` → **Oczekiwane 503 `SCHEMA_NOT_READY`**.
- [ ] UI: czy 503 jest obsłużone? Baner „Database not ready" zamiast pustego ekranu (L-08 dot. też tego).

### 12.9 Audit log

**Endpoint:** `GET /audit/:entityType/:entityId` (~l.1892), `GET /tables/:tableId/audit` (~l.1926)

- [ ] Po serii operacji CRUD: `GET /api/table-platform/tables/{tableId}/audit` → response `[{ entityType, entityId, action, userId, timestamp, diff }]`.
- [ ] Sprawdź, że każda operacja (create/update/delete rekord, zmiana schematu, AI Editor apply) jest zalogowana.
- [ ] **[DB]** Analogiczna tabela `tp_audit_log` lub odpowiednia.

### 12.10 Rate limiting formularzy publicznych

- [ ] Wyślij 10+ zgłoszeń formularza w szybkiej kolejności z tego samego IP (np. w pętli JS w Console incognito).
- [ ] **Oczekiwane po przekroczeniu limitu:** 429 `{ error: "Rate limit exceeded" }`.
- [ ] Sprawdź, czy limit jest skonfigurowany (szukaj w `form-public.routes.ts` lub middleware rate-limit).

---

## §13. Testy regresji / automatyczne

Istniejące testy do uruchomienia (`evidence/f2_tests_report.md`):

```bash
# Z repo root
npx jest --testPathPattern="tablePlatform|table-platform|TabeleView|TablePlatform" --forceExit 2>&1 | tail -30
```

Kluczowe pliki testowe:
- `src/components/AIChat/KimiWorkspace/__tests__/TabeleView.melsRouting.test.tsx` — routing MELS
- `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx` — frontend
- `server/src/services/tablePlatform/__tests__/TableAiEditorService.test.ts` — AI Editor (uwaga: `forceEnableForTesting:true` — nie testuje flag-OFF)
- `server/src/services/tablePlatform/__tests__/ViewQueryEngine.test.ts` — query engine
- `server/src/services/tablePlatform/__tests__/migrations.block-a-b.test.ts` — migracje (sprawdź brak kolizji 725/726 → 777/778)
- `server/src/services/tablePlatform/TableAiEditorLevels/__tests__/cellLevel.test.ts` i analogiczne dla 8 poziomów

- [ ] Uruchom wszystkie testy. Oczekiwane: **894+ PASS, 0 realnych FAIL** (po naprawieniu kolizji migracji). Każdy FAIL = wymaga analizy.
- [ ] **Krytyczne:** testy Records API są 100% zmockowane — wyniki PASS NIE dowodzą trwałości w DB. Testy manualne §1 są jedynym prawdziwym dowodem.
- [ ] Sprawdź, że testy `test.skip` w `crud/views/chat-to-schema.spec.ts` nie ukrywają realnych problemów.

---

## Format raportu

Dla każdego testu:

```
[PASS/FAIL/SKIP] §X.Y — Opis testu
  UI: ✅/❌ <obserwacja>
  Network: ✅/❌ <endpoint> → <status> <payload fragment>
  DB: ✅/❌ <zapytanie> → <wynik>
  Uwagi: <dowolne>
```

---

## Definition of Done (DoD)

Moduł M20 jest gotowy do oznaczenia jako **TESTED** gdy:

1. **§1 Records API:** każdy endpoint CRUD potwierdzony w Network + DB. Brak regresji cross-org (§8.4, §9.6 → 403).
2. **§2 Bazy/Tabele:** CRUD baz i tabel działa, typy pól z pełnej listy (min. 8) zweryfikowane.
3. **§3 Widoki:** Grid z inline-edit trwały, share/unshare potwierdzone, share_password bug L-03 udokumentowany.
4. **§4 Formuły:** formula/rollup/lookup działają, cykliczne zależności odrzucane.
5. **§5 AI Editor:** wszystkie 8 poziomów przetestowane (1-6 normalny user, 7-8 superadmin), apply/reject trwałe w DB, budżet 429 zachowany.
6. **§6 Realtime:** presence + update widoczne u drugiego usera (MANUAL potwierdzony).
7. **§7 Automatyzacje:** create/toggle/run-now/historia działają, validate-cron odrzuca błędne.
8. **§8 Formularze:** submit z incognito → rekord w DB, IDOR fix (submissions 403 innej org) potwierdzony.
9. **§9 Governed models:** CRUD + KPI działa; STUB udokumentowany (publish → NIE w M15/M16).
10. **§10 Flagi:** QA/SourcePack/Conversion UI niewidoczne, BE żywe (API odpowiada), stary komentarz route-header udokumentowany jako P3-doc.
11. **§12 Przekrojowe:** 0 błędów w Console, PL/EN OK, dark mode brak artefaktów koloru, A11y keyboard OK.
12. **Znane długi (NIE blokują DoD):** L-02 SSO plaintext, L-03 share_password, L-07 testy auto mock-only, L-08 niema degradacja flag-OFF, L-09 PublicViewPage EN-only, L-10 322 hex w data-grid.

---

## Testy manualne — Generatory Deliverable (premium TABLE quality)

> **Sekcja DOŁOŻONA 2026-06-23.** To NIE są testy istniejącej Table Platform (§1–§13 wyżej — grid/widoki/formuły/automatyzacje). To testy NOWEJ warstwy **„Generatory Deliverable" (premium TABLE)**: AI generuje **typowany schemat** (B4) + **conditional formatting** (R5/X2) + **wierny eksport `.xlsx`** (X2). Cel: Piotr testuje jakość premium TABLE do 100% i odbiera ją rubryką.
>
> **Grounding:** SSOT `docs/product/DELIVERABLES_GENERATORS_SPEC.md` · plany `docs/qa/deliverables/test-plan/{B,R,X}-series.md` · 30 scenariuszy `docs/qa/deliverables/scenarios/M20_TABLES.md` · rubryka odbioru `Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md` §4 (tabela) · teczka `Harvard/wdrozenie-100/M20-tabele-studio.md` sekcja „Generatory Deliverable" (EPIK G1-G5).
>
> **Tagi:** `[MANUAL]` ręczna weryfikacja · `[FLAG]` zależne od flagi premium · `[DB]` dowód w bazie/pliku.

### §P0. Prawda i preconditions (przeczytaj PRZED testami)

**Stan (zweryfikowany żywym LLM Sonnet 4.6, 2026-06-23):**
- Premium TABLE (B4) **DZIAŁA ~100% code-side:** 30/30 scenariuszy M20 zsweepowane do 100%; S01/S06/S07/S16 niezależnie 100% PREMIUM. Avg `scorePct` table = 87% (`runs/2026-06-22-live-pilot-sonnet46.json`).
- **Naprawiony bug data-loss:** `normalizeSeedRows` filtrował klucze seed-rowów ścisłą równością vs sanityzowany klucz pola → klucze `camelCase` z LLM **CICHO ODRZUCANE** → **puste kolumny** w zmaterializowanej tabeli. FIX = canonical key reconciliation. Ślad bug PRZED/po widoczny w `runs/2026-06-22-VTS-generated.md` §3.
- **NIE wpięte w żywe UI.** Premium = za flagą `ENABLE_DELIVERABLES_PREMIUM` (`deliverableGenerationTier.ts:13`, default **OFF**); generatory niewpięte w pipeline UI (chat→canvas→studio→grid). Jakość mierzona przez **harness/flagę**, NIE kliknięcia.

**Dwie warstwy testów (NIE myl):**
- **Warstwa 1 — Scoring-auto / Export-fidelity — WYKONALNE DZIŚ** (bez deploya): runner FT-6 na żywym LLM + scoring engine; vitest parsujący wygenerowany `.xlsx` (XML).
- **Warstwa 2 — Manual-UI / „otwórz w Excel" — WYMAGA WPIĘCIA/DEPLOYA**: przelot przez żywy pipeline UI za flagą ON + screenshot + head-to-head. ⚠️ **Nie wolno twierdzić, że jakość UI potwierdzona, dopóki nie ma żywego LLM przez UI.**

**Preconditions — jak włączyć premium (warstwa 1, DZIŚ):**
1. `[FLAG]` Klucz LLM ze stagingu Railway (lokalnie brak — patrz `finding_deliverables_ft6_pilot_blocker`; bez klucza mierzysz PODŁOGĘ deterministyczną, nie mózg).
2. Runner (NIE vitest — SDK structured pada pod vitest): z repo root:
   ```bash
   ANTHROPIC_API_KEY=<klucz-staging> ENABLE_DELIVERABLES_PREMIUM=true \
     node --import tsx scripts/deliverables/live-pilot-ft6.mts
   ```
   Runner ustawia `DOTENV_IGNORE_LOCAL=1` → NIE dotyka `.env.local` (=PROD centerbeam), NIE inicjalizuje DB. Bezpieczny.
3. Artefakt: JSON → `docs/qa/deliverables/runs/<data>-live-pilot-<model>.json` (`byModule[table].avgScorePct`, `rows[].scorePct/passed/failures/sample.fields/fieldTypes/seedRows`).
4. Export-fidelity (zero klucza, lokalny vitest): `npx vitest run tests/unit/deliverables/workbookBuilderCf.test.ts`.

**Preconditions — warstwa 2 (Manual-UI, dopiero po wpięciu):**
1. `ENABLE_DELIVERABLES_PREMIUM=true` na Railway staging (build env).
2. Generatory premium wpięte w pipeline UI (chat→canvas→studio→grid).
3. Deploy + login (`E2E_OWNER_EMAIL/PASSWORD`, `E2E_BASE_URL`). Headless zostawia canvas Ideas w skeletonie → R5 weryfikuj w REALNEJ przeglądarce (`finding_m09_live_test_gates`).

**Format raportu (każdy scenariusz daje rubryczne 3 oceny — `DELIVERABLES_QUALITY_RUBRIC.md` §6):**
```
[PASS/FAIL/SKIP] PT-XX — Opis
  Kompletność: ✅/❌  Merytoryka: ✅/❌  Grafika: ✅/❌  → werdykt
  Dowód: <JSON scorePct / XML fragment / screenshot / Excel screenshot>
```

---

### §P1. B4 — typowany schemat + kolory + KOMPLETNE seed rows

#### PT-01 — Tabela ryzyk (risk register) → typy + hex severity `[FLAG]` `[DB]` — **TESTOWALNE DZIŚ (warstwa 1)**
- **Mapowanie:** B4-S01 · M20 S05/S17 · EPIK G1.1/G1.2.
- **Precondition:** runner premium ON (§P0). Golden: `TABLE_SCENARIOS` S05 (lub S17 dla iconSet).
- **Kroki:**
  1. Odpal runner FT-6 (komenda §P0) z intentem „Tabela ryzyk projektu ERP: nazwa, severity (Low/Med/High), likelihood, mitygacja".
  2. Otwórz JSON wyniku → `rows[table].sample.fields` / `fieldTypes`.
- **Oczekiwane:**
  - severity = `singleSelect` z 3 opcjami (Low/Med/High); KAŻDA opcja ma **hex** (`requireSelectColors`).
  - Semantyka traffic-light: Low=green `#16A34A`, Med=amber `#D97706`, High=red `#DC2626` (`expectTrafficLightColors`).
  - ≥1 typed field (nie sam `singleLineText`); typy ∈ katalog.
- **Dowód:** JSON `rows[table].sample.fieldTypes` + `failures` puste dla `requireSelectColors`/`requireFieldType`. `scorePct` ≥ próg Q1 (≥85%).

#### PT-02 — Portfolio projektów (Airtable-style) → 8 pól, 2 selecty kolorowe `[FLAG]` `[DB]` — **DZIŚ**
- **Mapowanie:** M20 S07 · EPIK G1.1/G1.2.
- **Precondition:** runner premium ON. Golden S07.
- **Kroki:** runner z intentem „Portfolio 8 projektów: nazwa, owner, status (To Do/In Progress/Review/Done), priority (P0/P1/P2/P3), start_date, end_date, budget (currency), progress (percent)".
- **Oczekiwane:**
  - 8 pól; 2× `singleSelect` (status, priority) z kolorami; 2× `date`, 1× `currency`, 1× `percent`.
  - priority colors: P0=red/critical, P1=amber, P2=blue, P3=gray. status traffic-light gradient.
- **Dowód:** JSON `sample.fields/fieldTypes`; `scorePct` S07 = 100% (re-zweryfikowany PREMIUM).

#### PT-03 — **REGRESJA bug data-loss: ZERO pustych kolumn** `[FLAG]` `[DB]` — **DZIŚ (krytyczny)**
- **Mapowanie:** B4-S04 · EPIK G1.3 · WG-03 (teczka).
- **Tło:** `normalizeSeedRows` cicho odrzucał klucze `camelCase` z LLM → puste kolumny przy poprawnym nagłówku. Ten test to **regresja fixa** (canonical key reconciliation).
- **Precondition:** runner premium ON. Dowolny golden z ≥4 typowanymi kolumnami (S06/S07/S16).
- **Kroki:**
  1. Odpal runner → otwórz JSON `rows[table].sample.seedRows`.
  2. Dla KAŻDEJ typowanej kolumny ze schematu policz, ile seed-rowów ma niepustą wartość w tej kolumnie.
- **Oczekiwane (PASS):** **każda** typowana kolumna ma wartości we **wszystkich** seed-rowach (≥N). Zero kolumn, gdzie nagłówek istnieje, a wszystkie komórki puste.
- **Jak rozpoznać REGRESJĘ (FAIL):** otwórz `runs/2026-06-22-VTS-generated.md` §3 (tabela 11 pól × 8 wierszy) — tam PRZED-fix kolumny „Indeks gotowości / Najsłabszy wymiar / Główna bariera / Termin docelowy" są **puste** mimo wypełnionych „Dział/Liczba respondentów/Frekwencja/Priorytet/Właściciel/Pewność/Status". Jeśli świeży run pokazuje TEN wzorzec (pełny nagłówek + pusta kolumna pod spodem) = bug wrócił. **W UI/Excel objaw:** kolumna z nazwą, ale całkowicie pusta — łatwo przeoczyć przy „ładnym" nagłówku.
- **Dowód:** JSON `sample.seedRows` z liczbą niepustych komórek per kolumna; porównanie z liczbą pól.

#### PT-04 — `numFmt` mapowany z typu (budżet→currency, %→percent) `[FLAG]` — **DZIŚ**
- **Mapowanie:** B4-S02 · M20 S02 · EPIK G1.4.
- **Kroki:** runner z golden „budżet projektu: kategoria, plan, wykonanie, % realizacji".
- **Oczekiwane:** 2× `currency` (numFmt `#,##0.00`), 1× `percent` (`0.00%`); `minTypedFields` ✓.
- **Dowód:** JSON `sample.fields`; pełna weryfikacja numFmt w pliku → PT-09.

#### PT-05 — Multi-sheet TYLKO gdy explicit (budżet 4 sheety) `[FLAG]` — **DZIŚ**
- **Mapowanie:** M20 S26/S27 · EPIK G1.5.
- **Kroki:** (a) runner z „Roczny budżet: Sheet1=Summary, Sheet2=OpEx, Sheet3=CapEx, Sheet4=HC, cross-sheet formulas". (b) runner z prostym intentem (S01 lista zadań).
- **Oczekiwane:** (a) 4 sheety + Summary z cross-sheet formułą (`=OpEx!B10+CapEx!B10`); (b) 1 sheet (B4 NIE rozdmuchuje do multi-sheet bez explicit).
- **Dowód:** JSON sheets count.

#### PT-06 — Fallback gdy flaga OFF = STANDARD (fail-open) `[FLAG]` — **DZIŚ**
- **Mapowanie:** B4-S07 · B5-S02 · EPIK G1.6/G4.1.
- **Kroki:** runner z `ENABLE_DELIVERABLES_PREMIUM=false`.
- **Oczekiwane:** `fallbackUsed=true`, `tierUsed='STANDARD'`, schema deterministyczny waliduje, **brak crasha**. Premium ON → `tierUsed='PREMIUM'`, `source='llm'`, `fallbackUsed=false`.
- **Dowód:** 2 JSON-y (PREMIUM vs STANDARD) z `tierUsed`.

---

### §P2. R5 — Conditional Formatting w GridView + formuły AST

#### PT-07 — CF reguła >X → czerwony + formuła SUM/IF `[MANUAL]` `[FLAG]` — **warstwa 1 code-side DZIŚ; UI PENDING wpięcia**
- **Mapowanie:** R5-S01/S03/S04 · M20 S16/S19 · EPIK G2.1/G2.2.
- **Precondition (UI):** flaga premium ON na środowisku + wpięcie + `/my-work` → narzędzie Tabela (`IdeaTableTool`). **Headless = skeleton → testuj w realnej przeglądarce** (`finding_m09_live_test_gates`).
- **Kroki (UI, po wpięciu):**
  1. Otwórz tabelę z kolumną liczbową. Panel CF → dodaj regułę „wartość > X → tło czerwone".
  2. W kolumnie formuły wpisz `SUM(...)` w `FormulaEditor`; potem `IF(warunek, A, B)`.
- **Oczekiwane:** komórki >X mają czerwone tło (computed `background-color` lub klasa CF); formuła SUM = poprawna suma, IF = poprawna gałąź, brak błędu AST.
- **DZIŚ (code-side):** `formulaEngineCore` (parytet FE/BE) — sprawdź w teście jednostkowym/integ; CF schema w `WorkbookSchema.ts`.
- **Dowód:** screenshot gridu (UI) / wynik testu (code). **Mark: UI PENDING wpięcia.**

#### PT-08 — CF persyst po reload (config JSONB widoku) `[MANUAL]` `[FLAG]` `[DB]` — **PENDING wpięcia**
- **Mapowanie:** R5-S05/S06 · EPIK G2.3 · FT-2.
- **Kroki (UI):** dodaj regułę CF → poczekaj na PATCH zapisujący `config` widoku → odśwież (F5) → poczekaj na hydrate gridu.
- **Oczekiwane:** reguły CF wczytane z `config` JSONB widoku, kolory wracają. **Regresja autosave-race:** brak 2× POST→409 (patrz `finding_m07_canvas_hydrate_loading`).
- **Dowód:** `[DB]` `config` JSONB aktywnego widoku zawiera regułę CF; screenshot przed/po reload. **Mark: PENDING wpięcia + live przeglądarka.**

---

### §P3. X2 — eksport `.xlsx` z REALNYM CF + formatami (ExcelJS, nie fasada)

#### PT-09 — `.xlsx` zawiera CF + bgColor w XML (export-fidelity) `[DB]` — **TESTOWALNE DZIŚ (vitest)**
- **Mapowanie:** X2-S01-S06 · M20 S16-S25 · EPIK G3.1/G3.2.
- **Precondition:** brak (lokalny vitest, zero deploya/klucza).
- **Kroki:** `npx vitest run tests/unit/deliverables/workbookBuilderCf.test.ts`.
- **Oczekiwane:**
  - `xl/worksheets/sheet1.xml` (JSZip) zawiera `<conditionalFormatting>` + `databar` / `colorScale` (3-color ARGB `FFDC2626`/`FFF59E0B`/`FF16A34A`) / `iconSet`(`3TrafficLights`) / `cellIs`(`greaterThan`).
  - **Demaskacja fasady:** `xl/styles.xml` zawiera `FF<HEX>` bgColor (SheetJS by to ZGUBIŁ).
- **Dowód:** wynik vitest (asercje na XML).

#### PT-10 — `numFmt` waluta/data + nagłówek bold/freeze w pliku `[DB]` — **DZIŚ (vitest, dopisanie)**
- **Mapowanie:** X2-S07/S08/S09 · EPIK G3.3.
- **Kroki:** rozszerz `workbookBuilderCf.test.ts` o kolumnę `type:'currency'` i `type:'date'` + header bold+freeze; parsuj `styles.xml`/`sheet1.xml`.
- **Oczekiwane:** `numFmt` z maską waluty (`#,##0.00`/`zł`) i daty (builtin id lub `yyyy-mm-dd`); `<pane>` freeze + bold w styles.
- **Dowód:** wynik vitest.

#### PT-11 — Bez CF nadal builduje (PK magic, fail-open) `[DB]` — **DZIŚ**
- **Mapowanie:** X2-S10 · EPIK G3.4 · FT-8.
- **Kroki:** `buildWorkbookBuffer(schema bez CF)`.
- **Oczekiwane:** Buffer `>1000` bajtów, magic `0x50 0x4B` (PK). Brak chromium dla render-path → `unavailable` (no-throw).
- **Dowód:** Buffer w teście.

#### PT-12 — **„Otwórz w Excel"** — plik bez „repair", CF/kolory/formaty widoczne `[MANUAL]` — **computer-use (półautomat)**
- **Mapowanie:** X2-M01-M06 · MQ-T8 (rubryka §4D) · EPIK G3.5 · FT-7.
- **Precondition:** wyeksportowany `.xlsx` (z runnera/UI). To **JEDYNA** ścieżka dowodząca „Excel nie pokazuje 'repair' i CF się renderuje".
- **Kroki:**
  1. `mcp__computer-use__open_application` Excel (lub Numbers) → otwórz wyeksportowany plik.
  2. `screenshot`.
- **Oczekiwane:** plik otwiera się **bez** dialogu „repair"; widoczne: kolory komórek, data-bar/colorScale CF, symbol waluty + separatory, daty jako daty (sortowalne, nie tekst), nagłówek pogrubiony + freeze działa.
- **Dowód:** screenshot pulpitu (computer-use) → `docs/qa/screens/deliverables-X-<data>/`. **Mark: wymaga realnego Excela/Numbers.**

---

### §P4. Head-to-head vs Airtable (odbiór jakości graficznej)

#### PT-13 — Golden VTS u nas vs Airtable, ta sama rubryka `[MANUAL]` `[FLAG]` — **PENDING live render + ocena ekspercka**
- **Mapowanie:** B4-S08 · MQ-T10 (rubryka §4C/§4D) · EPIK G5.1 · Q3=VTS golden.
- **Precondition:** wygenerowany schemat VTS (już jest: `runs/2026-06-22-VTS-generated.md` §3, 11 pól × 8 wierszy — ale UWAGA: pokazuje ślad bug data-loss, użyj ŚWIEŻEGO runu po fixie) + eksport XLSX (WorkbookBuilder) lub zrzut gridu. Ten sam intent w Airtable.
- **Kroki:**
  1. Wygeneruj tabelę VTS (golden Q3) premium ON → eksport XLSX (PT-09/PT-12) lub screenshot gridu.
  2. Zbuduj tę samą tabelę w Airtable (ręcznie / import).
  3. Oceń OBA tą samą rubryką graficzną (`DELIVERABLES_QUALITY_RUBRIC.md` §4C): G1 typowanie, G2 kolory statusu, G3 styl tabel/CF, G4 format liczb/dat/waluty, G6 striping. Skala 1-5 (lub 0/1/2).
- **Oczekiwane (odbiór):** **nasz wynik ≥ Airtable na KAŻDYM wymiarze graficznym** (warunek odbioru §4 rubryki). Dodatkowo: K1 typy, K2 seed z realnych danych, M1 trafność schematu, M4 seed realistyczny.
- **Dowód:** tabela ocen (markdown) per oś nasz vs Airtable + mediana + podpis (Piotr/QA) + 2× artefakt (nasz XLSX/PNG vs Airtable PNG) → `docs/qa/deliverables/runs/<data>/h2h-table/`. **Mark: część programowa (eksport) DZIŚ; ocena 1-5 = ekspercka, NIE auto.**

#### PT-14 — CF na żywo (dodaj regułę → koloruje w gridzie I w eksporcie) `[MANUAL]` `[FLAG]` — **PENDING wpięcia**
- **Mapowanie:** MQ-T9 (rubryka §4D) · R5+X2 · EPIK G2/G3.
- **Kroki (UI):** w gridzie dodaj regułę CF → sprawdź kolor w gridzie → eksportuj XLSX → otwórz w Excel (PT-12).
- **Oczekiwane:** ta sama reguła koloruje komórki w gridzie I jest obecna w `.xlsx` (parytet ekran↔plik).
- **Dowód:** screenshot gridu + screenshot Excel. **Mark: PENDING wpięcia.**

---

### §P5. Mapa pokrycia premium TABLE (epik → scenariusz → wykonalność)

| EPIK (teczka) | Scenariusze | Warstwa | Wykonalność |
|---|---|---|---|
| G1 — B4 typy+kolory+seed | PT-01..PT-06 | 1 (Scoring-auto) | **DZIŚ** (runner + klucz staging) |
| G1.3 — regresja data-loss | PT-03 | 1 | **DZIŚ** (krytyczny — zero pustych kolumn) |
| G2 — R5 CF+formuły | PT-07, PT-08 | code DZIŚ / UI PENDING | code-side teraz; UI po wpięciu (live przeglądarka) |
| G3 — X2 eksport fidelity | PT-09..PT-11 | 1 (Export-fidelity-vitest) | **DZIŚ** (zero deploya/klucza) |
| G3.5 — „otwórz w Excel" | PT-12 | Manual (computer-use) | **DZIŚ** (półautomat, realny Excel) |
| G5 — head-to-head Airtable | PT-13, PT-14 | Manual + ekspercka | PENDING live render + ocena 1-5 |

**Odbiór (Etap 8 →UI):** każdy PT daje 3 oceny (Kompletność · Merytoryka · Grafika); head-to-head ≥ Airtable na każdym G = dowód „dorównaliśmy/wygraliśmy". „Jakość premium UI potwierdzona" wymaga żywego LLM przez UI (deploy flagi Railway + wpięcie + live-verify wg reguły „Verify before claiming").
