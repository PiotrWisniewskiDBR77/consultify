# SUPERADMIN DAY 15 — RAPORT 2026-08-26

Status dyżuru: **DOMKNIĘTY LOKALNIE — CZĘŚCIOWO / OPEN STOP-y**

Poziom raportowania: **TARGETED VERIFIED / FULL_DOD_NOT_PROVEN**. Zmiany produktowe i dowody lokalne wykonano; zero deployu, pushu, Railway i dostępu do zdalnej bazy.

## Oświadczenie o chronionym WIP (Z4/Z5)

Nie modyfikowałem chronionego worktree `/Users/piotrwisniewski/Developer/Consultify`. Jedyny dostęp do jego zawartości to jawnie autoryzowany przez nadzorcę odczyt zależności przez symlink `node_modules`; nie edytowano żadnego pliku w katalogu docelowym. Nie czytałem wariantów `PRESERVED_PRODUCT_WIP` / `NO_COPY`.

## Oświadczenie FREEZE (DEC-2026-08-25-65)

FREEZE zachowany: zero push, zero deployów, zero Railway i zero zdalnych baz. Jedyna migracja ma status **MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED** i została uruchomiona wyłącznie w jednorazowym lokalnym PostgreSQL na tmpfs. Kod projekcji działa także bez indeksu, więc pozostaje kompatybilny wstecz z zamrożonym demo.

## Warunki wstępne — wynik sprawdzenia

| Warunek                                 | Wynik | Dowód                                                                            |
| --------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| Worktree                                | PASS  | `/private/tmp/consultify-superadmin-day15`                                       |
| Gałąź                                   | PASS  | `codex/superadmin-day15-20260826`                                                |
| Tip przekazanej bazy                    | PASS  | `c71ce1dc2e1165cb81e06bc2b90abf15e2915bdb`                                       |
| Marker `f0caf6a821` jest przodkiem tipa | PASS  | `git merge-base --is-ancestor` zakończył się kodem 0                             |
| Instrukcja wiążąca                      | PASS  | 2608 linii                                                                       |
| TRIANGLE_COMPLETENESS_VERDICT           | PASS  | 185 linii; trafienia TRI-MUST-07/08/11 obecne                                    |
| SUPERADMIN_COMPLETENESS_REPORT          | PASS  | 334 linie; TRI-MUST-12 obecny                                                    |
| OWNER_DECISION_LEDGER / DEC-65          | PASS  | wpis na linii 117                                                                |
| PlatformOperationsView (fala 1)         | PASS  | 309 linii                                                                        |
| Hooki                                   | PASS  | `core.hooksPath=.husky`                                                          |
| Bezpieczne `node_modules`               | PASS  | nadzorca 2026-08-26 autoryzował odczyt zależności; symlink utworzony             |
| Replay PostgreSQL przed zmianami        | PASS  | 839 migracji; powtórka `Applying migrations: 0`; dry-run `Pending migrations: 0` |
| Zapis `settings` na PostgreSQL          | PASS  | PK `(key)`; INSERT/SELECT/DELETE sondy `day15:probe` przeszły                    |

## STOP — Blok 0 / zależności lokalne

Powód: zlecenie wymaga „symlink node_modules wg §0.3”, ale wiążąca instrukcja nie zawiera `node_modules`, `symlink` ani `ln -s`; jedyny znaleziony symlink rozwiązuje się do ścieżki objętej zakazem Z5 (zakaz odczytu i zapisu). Użycie go naruszyłoby instrukcję, a wybór innego cudzym kosztem byłby zgadywaniem lub naruszeniem Z6.

Dowód:

```text
$ rg -n "node_modules|symlink|ln -s" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY15_SUPERADMIN_INSTRUKCJA.md
<wynik pusty>

$ ls -ld node_modules
<brak ścieżki w worktree>

$ ls -ld /Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823/node_modules
... -> /Users/piotrwisniewski/Developer/Consultify/node_modules
```

Co zrobiłbym po wskazaniu bezpiecznego źródła: utworzyłbym symlink wyłącznie do jawnie autoryzowanego katalogu zależności poza chronionymi/cudzymi worktree, następnie wznowił Blok 0 od weryfikacji pięciu korekt, testów bazowych i jednorazowego PostgreSQL na porcie 4342.

Stan: **ROZSTRZYGNIĘTO 2026-08-26** — nadzorca jawnie autoryzował symlink tylko do odczytu. Dyżur wznowiono.

## Weryfikacja pięciu korekt z §1.4

| Korekta                                                | Wynik        | Dowód skrócony                                                          |
| ------------------------------------------------------ | ------------ | ----------------------------------------------------------------------- |
| 1 — TRI-MUST-12 istnieje                               | POTWIERDZONA | `STATUS_CHANGES_REQUIRING_CONFIRMATION`; `organization.status_changed`  |
| 2 — cztery trasy admin-data poza `:orgId`              | POTWIERDZONA | route patterns `:eventId` / `:sessionId`                                |
| 3 — sessions/all jest tenant-scoped, lecz bez roli     | POTWIERDZONA | `WHERE u.organization_id = ?`; brak `requireOrgAdmin` przed zmianą      |
| 4 — dwa destrukcyjne IDOR-y + dwie trasy bez filtra    | POTWIERDZONA | bezwarunkowe DELETE oraz zapytania `activity_logs`/`api_logs` bez WHERE |
| 5 — middleware audytu istnieje, projekcja ma dwie nogi | POTWIERDZONA | `index.ts:1274`; `readTenantAdminAuditProjection`                       |

## Testy stanu wyjściowego — przed

| Test                                                  | Przed                                        |
| ----------------------------------------------------- | -------------------------------------------- |
| `superadmin-organization-status-confirmation.test.ts` | 5/5 PASS                                     |
| `src/views/superadmin/__tests__`                      | PASS (pakiet)                                |
| `cross-org-idor.test.ts`                              | **92 FAIL / 22 PASS — zastany baseline**     |
| `adminP32.routes.test.ts`                             | 30/30 PASS                                   |
| `check-list-canon`                                    | 404 naruszenia / baseline 404 — brak wzrostu |

## S.1 / S.2 — sesje bezpieczeństwa

Status: **ZROBIONE_WG_DoD — kod, request-level i realdb SELECT**.

- `GET /security/sessions/all` wymaga teraz OWNER/ADMIN.
- Obie trasy DELETE najpierw rozwiązują zasób w organizacji z tokenu; obcy lub brakujący zasób daje 404.
- Własną sesję można usunąć bez roli admina; cudzą lokalną sesję oraz wszystkie sesje użytkownika tylko jako OWNER/ADMIN.
- Test własny: `day15.security.routes.test.ts` — 7/7 PASS przez supertest.
- Realdb Q.3: obca sesja → HTTP 404; bezpośredni `SELECT` potwierdził, że wiersz nadal istnieje.

## S.3 — cztery trasy admin-data

Status: **ZROBIONE_WG_DoD**.

- Cztery trasy wykonują load-then-check organizacji; obcy zasób jest maskowany jako 404.
- UPDATE/DELETE mają dodatkowy predykat organizacji; zachowano jawny wyjątek `super_admin` zgodny z istniejącym routerem.
- `apiAuthRateLimiter` dopięty do wszystkich czterech tras.
- Front grep: brak konsumentów naprawianych destrukcyjnych tras; istniejący `AuditComplianceTab` używa bezpiecznej trasy z `:orgId`.
- Test mock/request: `day15.admin-data.routes.test.ts` — 7/7 PASS.
- Wspólny pakiet realdb/request `day15.cross-tenant.routes.pg.test.ts` — 6/6 PASS, faktycznie wykonany. Dla S.3 bezpośrednie SELECT-y po HTTP 404 potwierdziły zachowanie obcej sesji i niezmieniony `security_events.resolved=0`. Operacje scheduled-events pozostają `BRAK_TABELI` na świeżym replayu i dlatego pełna pozycja Q.3 jest częściowa.

## S.4 — tenant-scoped access requests

Status: **ZROBIONE_WG_DoD**.

- Dodano `GET /api/access-control/requests/organization` z `verifyToken` + istniejącym `verifyAdmin`.
- Organizacja pochodzi wyłącznie z tokenu; opcjonalny `status` jest drugim predykatem.
- Istniejąca platformowa `GET /requests` pozostała nietknięta; dwa istniejące klienty nadal używają tej trasy.
- Test request: 5/5 PASS. Realdb request: pakiet Q.3 4/4 PASS; odpowiedź dla org A zawierała wyłącznie `day15-request-a`, bez rekordu org B.

## S.5 — audit logs i API usage

Status: **CZĘŚCIOWO**.

- Obie trasy wymagają teraz OWNER/ADMIN i filtrują `organization_id` z tokenu.
- `activity_logs.organization_id` istnieje; realdb Q.3 5/5 PASS potwierdził, że org A nie otrzymuje `day15-log-b` z org B.
- `api_logs.organization_id` istnieje, więc filtr jest poprawny. Świeży replay nie ma jednak kolumn `api_key_id`, `tokens_used`, `cost`, których wymaga zastane zapytanie; endpoint łapie błąd i zwraca pustą listę. Oznaczenie: **BRAK_API / zastana niezgodność schematu**, bez improwizowania semantyki kosztów.
- Test request z mockiem: cały pakiet security 13/13 PASS.

## T.2 — audyt reaktywacji

Status: **ZROBIONE_WG_DoD**. Wybrano drogę (A): audyt bez nowego potwierdzenia. Kontroler zachowuje styl callbackowy; przed zapisem odczytuje status także dla celu `active`, a zdarzenie emituje wyłącznie dla przejść `suspended|blocked|cancelled → active`. `pending|trial|active → active` nie jest oznaczane jako reaktywacja.

Istniejący test pozostał bitowo niezmieniony względem bazy i nadal przechodzi 5/5. Nowe przypadki przeniesiono do osobnego `superadmin-organization-reactivation-audit.day15.test.ts`: 6/6 PASS (3 krytyczne reaktywacje oraz 3 negatywy bez audytu). Łączny dowód: 11/11 PASS, bez wyjątku od Q.1.

## T.3 — luki inwentarzowe

| Formularz                               | Dostępne wartości        | Brakujące                     | Skutek                                              |
| --------------------------------------- | ------------------------ | ----------------------------- | --------------------------------------------------- |
| `OrganizationsView.tsx:593-595`         | active, pending, blocked | suspended, cancelled, trial   | zawieszenie osiągalne wyłącznie dedykowaną operacją |
| `SuperAdminOrgDetailsModal.tsx:268-270` | active, trial, blocked   | suspended, cancelled, pending | dwa niespójne katalogi statusów                     |

STOP: nie dodano `suspended` do formularzy. Propozycja: ujednolicić zawieszenie na dedykowanym `POST /tenants/:id/suspend` po decyzji właściciela.

| Warstwa          | Sprawdza `suspended`? | Dowód                                          | Skutek                                                    |
| ---------------- | --------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `AuthController` | NIE                   | sprawdza `pending` :325 i `blocked` :332       | użytkownik zawieszonej organizacji nadal może się logować |
| middleware auth  | NIE                   | grep `organization.*status` bez guardu runtime | aktywne sesje nie są blokowane                            |
| suspend P33      | NIE                   | tylko zapis statusu i liczba affectedUsers     | brak unieważnienia sesji                                  |

STOP: nie dodano egzekwowania `suspended` podczas FREEZE; wymaga decyzji właściciela i osobnego odbioru.

## A.1 — inwentarz mutacji Admin

Pomiar potwierdził punkt odniesienia: **83 mutacje / 20 jawnych pisarzy semantycznych / 63 bez pisarza semantycznego**. Globalny `auditLogMiddleware` jest zamontowany w `server/src/index.ts:1274`, ale pomija żądania bez `organizationId` lub `userId` (`auditLog.middleware.ts:374-376`).

| Plik                           | Mutacji | Audytowanych semantycznie | Bez |
| ------------------------------ | ------: | ------------------------: | --: |
| adminP32                       |      20 |                        19 |   1 |
| enterprise-compliance          |      10 |                         0 |  10 |
| access-control                 |       6 |                         0 |   6 |
| ai-governance                  |       6 |                         0 |   6 |
| admin-data                     |       6 |                         0 |   6 |
| teams                          |       5 |                         0 |   5 |
| ai-settings                    |       5 |                         1 |   4 |
| domains / backup               |       8 |                         0 |   8 |
| admin-bulk                     |       3 |                         0 |   3 |
| break-glass / service-accounts |       4 |                         0 |   4 |
| pozostałe 8 plików             |      10 |                         0 |  10 |

Ranking: break-glass → service accounts → bulk role change → access requests → domains.

## A.2 — trzecia noga projekcji

Status: **ZROBIONE_WG_DoD**.

- Projekcja czyta teraz tenant-scoped `audit_events WHERE org_id = ?`, normalizuje oba warianty kolumn i nie fabrykuje ryzyka (`risk_score/risk_level = null`).
- Istniejący limit 1000 przed paginacją pozostaje jako jawny dług, bez rozszerzania zakresu.
- Dodano addytywny indeks `(org_id, ts DESC)` w `20260826_day15_audit_events_org_ts_index.sql`.
- Migracja: **MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED**; kod jest kompatybilny ze schematem bez indeksu. Lokalnie: pierwsze zastosowanie 1, powtórka 0, dry-run 0.
- Testy: adminP32 mock 30/30 PASS; zastany realdb IAM 1/1 PASS bez zmian; nowy realdb 1/1 PASS — lokalny wiersz widoczny, obcy wykluczony, ryzyko null.

## A.3 / A.4

A.3: **NIE_ZACZĘTE**. A.4: stan przed 20/83 (24,1%) pisarzy semantycznych. Po A.2 projekcja widzi także globalne `audit_events`, ale nie zawyżam tego do 83/83: gwarancja jest fail-open i zależy od obecności kontekstu org/user. Kontrakt AC-005 pozostaje **NOT PROVEN**.

## P.1 — katalogi celów

| Akcja                    | Typ celu      | Skąd lista                                                | JEST / BRAK | Zapis działa na PG?  |
| ------------------------ | ------------- | --------------------------------------------------------- | ----------- | -------------------- |
| emergency-kill connector | connector     | nowy GET `/superadmin/connectors`, agregat `integrations` | JEST        | n/d                  |
| suspend virtual worker   | virtualWorker | istniejący GET `/api/virtual-workers`                     | JUŻ_BYŁO    | TAK — sonda settings |
| suspend AI model         | aiModel       | brak serwerowego katalogu; fallback klienta odrzucony     | BRAK_API    | TAK — sonda settings |

Klient używa `Promise.allSettled`: awaria jednej nogi nie usuwa organizacji/użytkowników ani pozostałych katalogów. Test katalogu request-level: 4/4 PASS (happy, empty, 401, błąd 500).

## P.3 — konsumenci override

| Klucz                   | Trafienia poza trasą zapisującą | Werdykt                                              |
| ----------------------- | ------------------------------: | ---------------------------------------------------- |
| `platform:mfa_override` |                               0 | `ZAPIS_BEZ_EGZEKWOWANIA` — STOP, akcja niewystawiona |
| `platform:sso_override` |                               0 | `ZAPIS_BEZ_EGZEKWOWANIA` — STOP, akcja niewystawiona |

Nie dopisano konsumenta ani przełącznika pozorującego egzekwowanie polityki.

## P.2 / P.4 — akcje i i18n

Status: **ZROBIONE_WG_DoD dla P.2 i P.4**. Commit `519a202532` wystawia dwie karty oparte o realne katalogi: awaryjne wyłączenie konektora i zawieszenie pracownika wirtualnego. Model AI pominięto jako `BRAK_API`; MFA/SSO jako `ZAPIS_BEZ_EGZEKWOWANIA`; bulk export jako `BRAK_API`. Każda wystawiona akcja ma nazwany cel, reason, potwierdzenie serwerowe bez optymistycznego sukcesu; konektor pokazuje zasięg tenantów.

Pakiet Day 15 po polish-passie: 6/6 PASS (cztery zachowania P.2 oraz uczciwy empty/error katalogu). Istniejący pakiet fali 1: 10/10 PASS. Dowód EN: 1/1 PASS. Cały katalog UI superadmin: 18/18 PASS.

Pomiar literalną procedurą Q.4 na rzeczywistym tipie bazy dał **przed: PL 216 / EN 216**, a nie zapisane w instrukcji 267/267. Stan po zmianie: **PL 256 / EN 256**, `PL-only []`, `EN-only []`. Zero `defaultValue`, zero polskich literałów w JSX. Rozbieżności punktu odniesienia nie ukrywam; parytet jest zachowany.

### Q.1 — rozstrzygnięcie DEC-2026-08-25-83

Nadzorca jednoznacznie dopuścił wyłącznie lokalne użycie `createRealUseTranslation('pl')` w `PlatformOperationsView.test.tsx`, bez zmiany asercji. Dodano tylko ten mock; liczba istniejących asercji i ich treść nie uległy zmianie. Wynik: 10/10 PASS. Globalnego setupu Z18 nie dotknięto.

## P.6 — polish-pass

Status: **CZĘŚCIOWO**. Commit `acb05b94e1`; realny komponent w lokalnym harnessie na porcie 4340, bez logowania i backendu. Dodano jawne rozróżnienie pustego katalogu i błędu pojedynczej nogi oraz lokalizację przycisku anulowania.

|   # | Punkt                                    | Wynik              | Dowód                                                                                                                                                      |
| --: | ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | zero crimsonu dekoracyjnego              | OK                 | grep plików produktu/harnessu: 0                                                                                                                           |
|   2 | danger tylko dla critical                | OK dla nowych kart | konektor jest `critical`; worker `high` nie używa czerwieni na karcie                                                                                      |
|   3 | niebieski fokus każdego pola i przycisku | **NIE OK**         | pole reason i przyciski powierzchni mają `c-focus`; zastany confirm button współdzielonego `ConfirmDialog` używa `focus:ring-danger-500/40`; plik poza Z17 |
|   4 | tokeny c-\*, zero hexów                  | OK                 | grep: 0                                                                                                                                                    |
|   5 | light/dark czytelne                      | OK                 | cztery główne PNG                                                                                                                                          |
|   6 | PL/EN bez rozjazdu                       | OK                 | cztery główne PNG, EN 1280 bez overflow                                                                                                                    |
|   7 | zero polskich literałów JSX              | OK                 | grep: 0                                                                                                                                                    |
|   8 | zero emoji/ozdobników                    | OK                 | oględziny siedmiu PNG                                                                                                                                      |
|   9 | uczciwy empty                            | OK                 | `platform-operations-empty-light-pl.png`                                                                                                                   |
|  10 | uczciwy error                            | OK                 | `platform-operations-catalog-error-dark-en.png`                                                                                                            |
|  11 | critical oddzielone od high              | OK                 | osobne sekcje i semantyczny danger tylko nagłówka critical                                                                                                 |
|  12 | reason <3 blokuje                        | OK                 | test + kadr dialogu, `confirmEnabled=false`                                                                                                                |
|  13 | brak poziomego scrolla 1280/1024         | OK                 | 1280: client=scroll=1280; 1024: client=scroll=1009 po uwzględnieniu pionowego scrollbara                                                                   |
|  14 | etykiety a11y                            | OK                 | select przez label; textarea `aria-label=Powód`; DOM snapshot                                                                                              |

Zrzuty w `modules/14_ADMIN/evidence-superadmin-day15/`: light/dark × PL/EN, empty PL, catalog-error EN, dialog focus 1024 PL. P.6 nie jest zawyżone do pełnego PASS z powodu punktu 3.

## Zakres wykonany

| Pozycja                                | Status                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Blok 0: baza, marker, materiały, hooki | ZROBIONE_WG_DoD                                                              |
| P.1                                    | ZROBIONE_WG_DoD                                                              |
| P.2                                    | ZROBIONE_WG_DoD                                                              |
| P.3                                    | STOP — ZAPIS_BEZ_EGZEKWOWANIA                                                |
| P.4                                    | ZROBIONE_WG_DoD                                                              |
| P.5                                    | n/d — brak nowej powierzchni                                                 |
| P.6                                    | CZĘŚCIOWO — 13/14 polish-pass                                                |
| T.1                                    | NIE_ZACZĘTE                                                                  |
| T.2                                    | ZROBIONE_WG_DoD                                                              |
| T.3                                    | ZROBIONE_WG_DoD / STOP                                                       |
| S.1–S.2                                | ZROBIONE_WG_DoD — realdb wykonany                                            |
| S.3                                    | ZROBIONE_WG_DoD                                                              |
| S.4                                    | ZROBIONE_WG_DoD                                                              |
| S.5                                    | CZĘŚCIOWO / BRAK_API                                                         |
| A.1                                    | ZROBIONE_WG_DoD                                                              |
| A.2                                    | ZROBIONE_WG_DoD                                                              |
| A.3                                    | NIE_ZACZĘTE                                                                  |
| A.4                                    | CZĘŚCIOWO / NOT PROVEN                                                       |
| Q.1                                    | PASS wg DEC-2026-08-25-83                                                    |
| Q.2                                    | CZĘŚCIOWO — targeted contracts, nie każda powierzchnia ma osobne 4 przypadki |
| Q.3                                    | CZĘŚCIOWO — realdb wykonany; scheduled-events BRAK_TABELI                    |
| Q.4                                    | PASS — PL/EN 256/256, listy różnic puste                                     |
| Q.5                                    | PASS — fixture i 7 PNG w jednym katalogu                                     |

## §Q — testy końcowe i zasięg

Żaden test pominięty przez `skipIf` nie jest raportowany jako PASS. Pakiet realdb był faktycznie wykonany z `RUN_DB_TESTS=1`, `MOCK_DB=false` i PostgreSQL URL na porcie 4342.

| Pakiet                                                          | Wynik                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 10 jawnych plików Day 15 + adminP32 + TRI-MUST-12, w tym realdb | **78/78 PASS**, 10/10 plików                                                                     |
| `src/views/superadmin/__tests__`                                | **18/18 PASS**, 4/4 pliki                                                                        |
| `cross-org-idor.test.ts`                                        | **92 FAIL / 22 PASS**, identycznie przed/po; zastany mock nie eksportuje `validateOrgMembership` |
| migracje świeża/powtórka/dry                                    | **840 / 0 / 0**                                                                                  |
| check-list-canon                                                | **404 / baseline 404**, brak wzrostu                                                             |

Zasięg: **ZASIĘG CZĘŚCIOWY**. Uruchomiono wszystkie nowe testy, całe `src/views/superadmin/__tests__`, istniejące pakiety adminP32 i TRI-MUST-12 oraz jawny szeroki cross-org. Nie uruchomiono pełnego Vitest/tsc repo — instrukcja tego zabrania. Nie uruchomiono katalogów wszystkich konsumentów współdzielonych routerów w całym monorepo; szeroki zastany pakiet pozostaje czerwony i nie był modyfikowany.

Q.2 pozostaje **CZĘŚCIOWO**: własne request-level pakiety pokrywają happy/4xx/cross-org dla krytycznych tras, lecz nie każda zmieniona powierzchnia ma cztery osobne przypadki w izolowanym pliku (szczególnie A.2 i S.5 API usage ze schematem `BRAK_API`).

Q.3 jest osobnym, nazwanym realdb pakietem i wykonał 6/6 PASS: foreign security session, foreign user bulk-delete (dwa wiersze zachowane SELECT-em), foreign admin-data session, foreign security event, tenant access requests i tenant audit logs. Macierz pozostaje **CZĘŚCIOWO**, ponieważ świeży replay 840 migracji nie tworzy tabeli `scheduled_events`; dwóch wymaganych skutków PUT/DELETE nie da się potwierdzić realnym SELECT-em bez wymyślenia tabeli. Oznaczenie: **BRAK_TABELI / BRAK_API**. `api_logs` ma osobno brak wymaganych kolumn (`api_key_id`, `tokens_used`, `cost`).

### Osiem dowodów domknięcia

1. Z18 global test infra: wynik pusty.
2. Z16 effective access/capability: wynik pusty; `effectiveAccessService` nietknięty.
3. Z11 nawigacja/router shell: wynik pusty.
4. Migracje: wyłącznie `20260826_day15_audit_events_org_ts_index.sql`.
5. Flagi/defaultValue: brak nowej flagi (P.5 n/d), brak dodanych `defaultValue`.
6. Z17 wyjątki z uzasadnieniem: `dev-render/main.tsx` i nowy ekran wyłącznie dla P.6; nowe pliki `__tests__` dla Q.2/Q.3; istniejący `PlatformOperationsView.test.tsx` wyłącznie zatwierdzony mock DEC-83. Pozostałe pliki mieszczą się w allowliście.
7. Kanon tabel: 404/baseline 404, brak nowych naruszeń.
8. Hooki `.husky`; symlink wskazuje jawnie autoryzowany read-only katalog zależności; końcowy worktree czysty po commicie raportu.

## Czego NIE zrobiłem i dlaczego

- Nie wykonałem `git fetch --all` — zgodnie ze zleceniem.
- Symlink do zależności jest używany tylko do odczytu na podstawie jawnej autoryzacji nadzorcy z 2026-08-26; nie edytuję jego zawartości.
- Nie uruchomiłem Railway ani żadnej operacji chmurowej — DEC-65/Z8.
- Nie zmieniam zastanych 92 czerwonych testów z cudzych modułów ani globalnych mocków.
- Jednorazowy kontener `cx-day15-pg` używał wyłącznie tmpfs `/var/lib/postgresql/data` (mounts `[]`, tmpfs jawny) i został usunięty po końcowym przebiegu Q. Filtry `docker ps -a --filter name=cx-day15` i `docker volume ls -q | grep -i cx-day15` były puste.
