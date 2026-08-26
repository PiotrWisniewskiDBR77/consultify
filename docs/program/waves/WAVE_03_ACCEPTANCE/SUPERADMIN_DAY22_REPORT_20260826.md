# Superadmin dzień 22 — raport dyżuru 2026-08-26

Baza związana: marker `609e9235e0` (instrukcja: `01d418104f`). Tip `codex/m03-admin-20260824`: `f560de2368`.
Gałąź: `codex/superadmin-day22-20260826`. Worktree: `/private/tmp/consultify-superadmin-day22`.
Port PG: `5481`. Kontener: `cx-day22-pg` (stan końcowy opisany w sekcji sprzątania).

## Oświadczenia graniczne

- Marker: `MARKER OK`. Rozjazd marker→tip m03: pięć commitów `df4ae9b47e..f560de2368`; pliki: ledger, migracje `20261121..23`, `server/src/ai/asyncJobService.ts`. Zgodnie z DEC-95 nie wykonano rebase.
- `git fetch --all --prune`: `origin` i `github-backup` pobrane; remote `icloud-source` wskazuje nieistniejący cudzy worktree `/private/tmp/consultify-staging-deploy-e6ca` i zwrócił błąd. Nie dotknięto tego worktree.
- Chroniony `/Users/piotrwisniewski/Developer/Consultify`: wyłącznie symlink `node_modules` do odczytu (DEC-86); zero innych odczytów i zapisów.
- Zero Railway, deployu, zdalnych baz, pushu i merge. Zero zmian w `src/`, strażniku DEC-105, ośmiu frontach, Z16, globalnych pisarzach audytu oraz `superadmin.routes.ts`.

## Dowód celu połączenia (Z19)

Każdy test DB uruchomiono z prefiksem w tej samej linii:

`DATABASE_URL="postgres://postgres:cx@localhost:5481/cx_day22" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false`.

Dosłowny readback:

```text
 current_database | inet_server_port
------------------+------------------
 cx_day22         |
(1 row)
```

Pusty `inet_server_port()` jest właściwością połączenia przez socket wewnątrz kontenera; z hosta testy raportowały `host=localhost`, `database=cx_day22`, port mapowany `5481:5432`.

## Warunki wstępne

| Warunek                  | Wynik                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| marker                   | `MARKER OK`                                                                                                  |
| dzień 15                 | `normalizeUnifiedAuditEvent`, `FROM audit_events`, indeks i test istnieją                                    |
| DEC-105                  | strażnik istnieje; 32 pliki odwołują się do niego                                                            |
| rdzeń                    | `readTenantAdminAuditProjection`, `getAdminActor`, globalny middleware, `requireAudit`, `logAction` istnieją |
| uczciwość                | `risk_score: null` istnieje                                                                                  |
| materiały                | DEC-85/98/105/116 oraz TRI-MUST-08/OBS-18 obecne; Day 15 = 287 linii; 14_ADMIN = 84 linie                    |
| korekta długości ledgera | 172, nie oczekiwane 168 — rejestr urósł, treść decyzji zgodna                                                |
| migracje                 | przebieg 1: 847; przebieg 2: 0; dry: 0 pending                                                               |
| świeża baza              | sześć z sześciu relacji istnieje                                                                             |
| numer dnia 22            | żadna migracja niepotrzebna; nie utworzono pliku `2026113x`                                                  |

## Pozycje — tabela zbiorcza

| Pozycja               | Status            | Commit       | Dowód                                                                      |
| --------------------- | ----------------- | ------------ | -------------------------------------------------------------------------- |
| A.1 pięć tabel        | `ZROBIONE_WG_DoD` | `cd500abe0a` | `to_regclass` 6/6 + kod pisarzy/czytelników                                |
| A.2 inwentarz pisarzy | `ZROBIONE_WG_DoD` | `cd500abe0a` | 83/20/63 potwierdzone; lista zwarta poniżej                                |
| A.3 ranking           | `ZROBIONE_WG_DoD` | `cd500abe0a` | ranking 1–5; zakres dwóch plików rankingu 1–2                              |
| B.1 fail-closed       | `CZĘŚCIOWO`       | `5065e37036` | 4/7 tras, 9/9 RealPG wraz z B.3; bulk STOP                                 |
| B.2 ranking 4–5       | `NIE_ZACZĘTE`     | —            | warunek B.1 nie jest domknięty                                             |
| B.3 nogi 4/5          | `ZROBIONE_WG_DoD` | `5065e37036` | eksperyment: `0/0/2/0/1`; nóg nie dodano                                   |
| C.1 negatywy          | `CZĘŚCIOWO`       | `5065e37036` | walidacja + dwa negatywy cross-tenant z readbackiem                        |
| C.2 wiersz-widmo      | `CZĘŚCIOWO`       | `5065e37036` | dwa negatywy zero semantic rows; nie wszystkie 5 tabel dla każdej trasy    |
| C.3 dowody mutacyjne  | `NIE_ZACZĘTE`     | —            | nie neutralizowano chronionych kontroli                                    |
| D scheduled_events    | `ZROBIONE_WG_DoD` | `cd500abe0a` | istnieje po 847 migracjach; producent 20261120                             |
| E.1 tenant read       | `CZĘŚCIOWO`       | `5065e37036` | list udowodniony; stats/export niepełne                                    |
| E.2 superadmin read   | `STOP`            | raport       | wymagałby rozszerzenia platformowej powierzchni i pełnych testów kontraktu |
| T                     | `CZĘŚCIOWO`       | `5065e37036` | nowe 9/9 po eksperymencie; pełny wynik końcowy poniżej                     |
| R.1                   | `CZĘŚCIOWO`       | commit R     | tylko faktyczny zakres; SHA tego commita                                   |

## A.1 — pięć tabel audytowych

| Tabela                     | Producent DDL                                                     | Świeża baza | Pisarz                                                  | Tryb awarii                                                       | Org/czas                     | Projekcja / inny czytelnik                      |
| -------------------------- | ----------------------------------------------------------------- | ----------- | ------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `admin_audit_logs`         | `900_prod_missing_tables_hotfix.sql:841` (martwy także `236:170`) | TAK         | `adminAuditService.logAction`                           | fail-open                                                         | `organization_id/created_at` | noga A; SuperAdminController                    |
| `role_change_audit_events` | `20260816_admin_iam_operations.sql:1`                             | TAK         | IAM command/people services                             | transakcyjny pisarz dziedzinowy                                   | `organization_id/created_at` | noga B                                          |
| `audit_events`             | `20260809_artifact_studio_audit_and_presentation_cards.sql:7`     | TAK         | `AuditEventsService`; `requireAudit`; global middleware | fail-closed przez `requireAudit`, globalnie fire-and-forget       | `org_id/ts`                  | noga C                                          |
| `activity_logs`            | `000_z_core_baseline.sql:482`                                     | TAK         | `ActivityService`                                       | globalnie fire-and-forget; eksperyment dnia 22: zapis nie powstał | `organization_id/created_at` | NIE; security/AdminData/SuperAdmin readers      |
| `audit_log`                | `000_zz_core_baseline_producers_fresh_db_gap.sql:193`             | TAK         | `auditService` i pisarze dziedzinowi                    | globalnie fire-and-forget                                         | `organization_id/timestamp`  | NIE; `/api/audit-logs` i czytelnicy dziedzinowi |

Fraza 3/5 dotyczy tej piątki. Nie oznacza pięciu niezależnych zdarzeń. Eksperyment pokazał, że jedna mutacja z semantycznym pisarzem dała `audit_events=2` (semantyczny + generyczny) i `audit_log=1` (duplikat generyczny), a `activity_logs=0`. Dodanie nóg 4/5 zwiększyłoby duplikację i nie naprawiłoby awarii pisarza activity.

## A.2 — inwentarz 83 mutacji

Klasyfikacja przed dyżurem: 20 `AUDYTOWANY_PROJEKCJĄ` semantycznie, 63 `NIEAUDYTOWANY` semantycznie. Pokrycie generyczne jest potencjalne, ale nie jest gwarancją: tylko 2xx, wymaga kontekstu, fail-open/fire-and-forget, semantyka wywiedziona z URL. Pomiar dnia 15 został potwierdzony.

| Plik                    | Trasy mutujące (jedna pozycja na trasę; linie stanu wejściowego)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                                                                 Semantyczne przed | Generyczne              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------: | ----------------------- | --------- |
| `adminP32.routes.ts`    | POST `/people` 2357; POST `/access-codes` 2398; PUT `/billing/plan` 2529; PUT `/iam/policy` 2580; POST `/iam/assignments` 2631; DELETE `/iam/assignments/:id` 2646; POST `/billing/payment-methods` 2675; PUT `/billing/payment-methods/:id/default` 2690; DELETE `/billing/payment-methods/:id` 2705; PUT `/billing/alerts` 2753; PUT `/billing/tax-settings` 2797; PUT `/compliance/data-retention` 2822; POST `/identity/scim/tokens` 2853; DELETE `/identity/scim/tokens/:id` 2873; POST `/identity/scim/group-mappings` 2888; DELETE `/identity/scim/group-mappings/:id` 2927; PUT `/security | /security/policy`2954; PUT`/sso-self`2969; POST`/sso-self/validate`2995; PUT`/collaboration` 3025 | 19/20                   | warunkowe |
| `enterprise-compliance` | POST `/dlp/rules`; PUT toggle; DELETE rule; POST scan; PUT residency; POST retention initialize; PUT schedule; POST execute; POST preserve; PUT ai-policy                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                                                                              0/10 | warunkowe               |
| `access-control`        | POST `/requests`; PUT approve; PUT reject; POST `/codes`; POST register; DELETE code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                                                                                               0/6 | warunkowe               |
| `ai-governance`         | PUT policy; PUT context-policy; PUT privacy; DELETE memory; PUT visibility; PUT sensitivity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                                                                                               0/6 | warunkowe               |
| `admin-data`            | PUT tier; PUT resolve security event; DELETE session; POST scheduled event; PUT scheduled event; DELETE scheduled event                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                               0/6 | warunkowe               |
| `organization/teams`    | POST team; PUT team; DELETE team; POST member; DELETE member                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                                                                                               0/5 | warunkowe               |
| `ai-settings`           | PUT superadmin; PUT org; PUT user; PUT user tier; POST compliance generate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                               1/5 | warunkowe               |
| `domains`               | POST; PUT id; DELETE id; POST verify                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                                                                                               0/4 | warunkowe               |
| `backup`                | POST restore; DELETE id; POST manual; POST organization/manual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                               0/4 | warunkowe               |
| `admin-bulk`            | POST bulk-import; POST bulk-role; POST bulk-email                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                                                                               0/3 | warunkowe               |
| `break-glass`           | POST sessions; DELETE session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                  0/2 → **2/2 po** | warunkowe + semantyczne |
| `service-accounts`      | POST account; DELETE account                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                                                                                  0/2 → **2/2 po** | warunkowe + semantyczne |
| `ai-quality`            | POST feedback review; POST pattern status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                                                                               0/2 | warunkowe               |
| `health-panel`          | POST run; POST run probe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                                                               0/2 | warunkowe               |
| pozostałe               | adminAlerts POST; guests DELETE; organization-profile PUT; seats PUT; security-alerts PUT; sessions DELETE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                               0/6 | warunkowe               |

Suma po dyżurze: **24/83 (28,9%) semantycznie widziane przez projekcję**. Generyczne pokrycie nie jest sumowane jako PASS. Poza Adminem skan wykazał liczne pisarze dziedzinowe (m.in. kontrolery Tools/Assessment do `audit_log`); pełne ogólnoaplikacyjne AC-005 pozostaje `NOT PROVEN`.

## A.3 — ranking i decyzja drogi

|   # | Plik             | Szkoda                                 | Droga                                | Zakres             |
| --: | ---------------- | -------------------------------------- | ------------------------------------ | ------------------ |
|   1 | break-glass      | niewidoczne nadanie awaryjnego dostępu | (ii) `requireAudit`                  | TAK, 2 trasy       |
|   2 | service-accounts | niewidoczne poświadczenie maszynowe    | (ii) `requireAudit`                  | TAK, 2 trasy       |
|   3 | admin-bulk       | masowa zmiana dostępu                  | (ii), ale transakcja wymaga projektu | STOP/CZĘŚCIOWO     |
|   4 | access-control   | zatwierdzanie dostępu                  | (i) `logAction`                      | NIE — B.1 niepełne |
|   5 | domains          | przejęcie domeny                       | (i) `logAction`                      | NIE — B.1 niepełne |

Limit to dwa pliki tras z top 5, czyli poniżej maksymalnych pięciu. `bulk-email` nie ma realnego enqueue: kod wyłącznie loguje i zwraca sukces, więc wpis „wysłano/zakolejkowano” byłby zakazaną atrapą Z22. `bulk-role` mutuje przed audytem i wymaga transakcji z pisarzem; nie improwizowano.

## B/C/E — dowody

| Trasa                      | Mutacja/readback             | Audyt                                | Awaria audytu                                        | Tenant/odmowa                                     | Projekcja                    |
| -------------------------- | ---------------------------- | ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------- | ---------------------------- |
| POST break-glass sessions  | `admin_sessions.is_active=1` | semantic resource, reason+approvedBy | 503 + `operationApplied:true`, wiersz sesji istnieje | walidacja + obcy approver                         | list przez nogę C            |
| DELETE break-glass session | `is_active 1→0`              | before/after                         | kontrakt wspólny                                     | obca sesja 404, nadal active, zero semantic row   | noga C                       |
| POST service account       | niezależny SELECT konta      | scopes, bez tokenu/sekretu           | 503 + `operationApplied:true`, konto istnieje        | 400 pusty stan, zero row                          | HTTP list, `risk_score:null` |
| DELETE service account     | niezależny SELECT count=0    | before/after                         | kontrakt wspólny                                     | obce konto 404, nadal istnieje, zero semantic row | noga C                       |

Decyzja B.1 pkt 3: **(b)**. Mutacja i audyt nie korzystają z jednego interfejsu transakcyjnego. Koperta 503 jawnie mówi, że operacja została wykonana, lecz audyt nie został zapisany. To uczciwy dług, nie pozorna atomowość.

Konwencja C.2: odmowa nie zostawia audytu. Globalny middleware zapisuje wyłącznie 2xx, a semantyczny pisarz jest po potwierdzonej mutacji. Próby nadużycia pozostają niewidoczne; zmiana wymaga decyzji o globalnym wolumenie i jest poza zakresem.

### Eksperyment B.3

Jedna realna `POST /api/admin/service-accounts`, realny router, realny `requireAudit` i zamontowany globalny middleware; polling 50 ms, budżet 2 s.

| Tabela                   | Delta | Interpretacja                                                 |
| ------------------------ | ----: | ------------------------------------------------------------- |
| admin_audit_logs         |     0 | brak drogi (i)                                                |
| role_change_audit_events |     0 | nie operacja IAM                                              |
| audit_events             |     2 | semantic event + generyczny create                            |
| activity_logs            |     0 | globalny pisarz próbował, ale wiersz nie powstał — znalezisko |
| audit_log                |     1 | generyczny duplikat tego samego requestu                      |

Rozstrzygnięcie **A: nie dodawać nóg 4/5**. `audit_log` dubluje zdarzenie, `activity_logs` nie dostarczyła zdarzenia. Pokrycie tabelowe zostaje 3/5; luką jest jakość/pokrycie pisarzy, nie liczba SELECT-ów projekcji.

## Dowody osiągalności (Z20)

| Pozycja         | Wejście                                             | Montaż                                                        | Router/pisarz                       | Zapis                                              | Noga                                       |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| break-glass     | POST/DELETE `/api/admin/break-glass/sessions[/:id]` | `Gateway.ts:791`                                              | route + `requireAudit`              | `audit_events.action/resource_type`                | `adminP32.routes.ts:2273`, normalize :2231 |
| service account | POST/DELETE `/api/admin/service-accounts[/:id]`     | `Gateway.ts:795`                                              | route + `requireAudit`              | `audit_events.action/resource_type`                | jw.                                        |
| B.3             | POST service account przez global middleware        | `index.ts:1274` kontrakt produkcyjny; test montuje middleware | `auditLog.middleware.ts` + semantic | trzy mechanizmy, faktycznie audit_events/audit_log | noga C; nóg 4/5 nie dodano                 |

## Kontrakt dla frontu

| Trasa                           | Body                             | Sukces                  | Nowy błąd                                            | Front bez zmian?                                             |
| ------------------------------- | -------------------------------- | ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| POST break-glass sessions       | `breakGlassReason`, `approvedBy` | 201, istniejący kształt | 503 `{code:AUDIT_UNAVAILABLE,operationApplied:true}` | sukces TAK; 503 wymaga jawnego komunikatu                    |
| DELETE break-glass sessions/:id | —                                | 200, istniejący kształt | jw.; 409 przy braku potwierdzenia revoke             | sukces TAK; błędy do obsługi                                 |
| POST service-accounts           | name/scopes/...                  | 201, istniejący kształt | jw.                                                  | sukces TAK; 503 do obsługi                                   |
| DELETE service-accounts/:id     | —                                | 204                     | jw.; 409 przy nieudanym readback                     | sukces TAK; błędy do obsługi                                 |
| superadmin audit surface        | —                                | bez zmian               | STOP                                                 | do czasu osobnej naprawy nie widzi wpisów `audit_events`/IAM |

## STOP-y i znaleziska

### STOP — ranking 3 / admin-bulk

Powód: `/users/bulk-email` jest zastaną atrapą zewnętrznego skutku, a `bulk-role` wymaga wspólnej transakcji mutacja+audyt lub zatwierdzonej koperty częściowego sukcesu.
Dowód: `admin-bulk.routes.ts:164-210` — komentarz „For now, we just log”; rola jest aktualizowana przed odpowiedzią.
Co dalej: najpierw realny enqueue/readback dla e-mail; osobno donated-transaction lub jawny kontrakt częściowego sukcesu dla bulk-role.
Stan: NIE ZACOMMITOWANO.

### STOP — E.2

Powód: platformowa powierzchnia SuperAdmin czyta tylko `admin_audit_logs`; pełne rozszerzenie wymaga utrzymania cross-tenant, degraded per leg i testów kompatybilności konsumenta.
Skutek: wpisy dnia 22 są widoczne tenantowo, niewidoczne na ekranie Superadmin.

Znaleziska nie naprawiane: nieaktualny komentarz `adminAuditService.getStats`; `resolveLog` po samym id; domain verification w pamięci; LIMIT 1000 przed paginacją; brak audytu odmowy; globalny `ActivityService` nie utrwalił wiersza w eksperymencie; globalny middleware może dublować semantic `audit_events`.

## Migracje

Żadna migracja nie była potrzebna. `scheduled_events`, pięć tabel audytowych oraz indeks dnia 15 istnieją po pełnym runnerze. Status: istniejąca `20261120` zweryfikowana lokalnie; zero zdalnego wykonania.

## Testy

### Baseline przed pierwszym commitem

- projection RealPG: 1/1 + 1/1 PASS.
- reactivation: 6/6 PASS; cross-org M17: 8/8 PASS.
- `adminP32.security-audit`: **1 FAIL zastany** (403 zamiast 200).
- `tests/integration/admin`: **5 plików FAIL / 3 PASS; 15 FAIL / 46 PASS / 19 skipped** (m.in. SSO self 403 zamiast 200).
- DEC-105 middleware: 19/19 + 4/4 PASS.
- Z16: 5/5 PASS.

Nowe testy RealPG: 9 przypadków po B.3 (happy, walidacja, cross-tenant, delete readbacks, dwa wymuszone błędy audytu, phantom-row, potrójny zapis). Ostateczny wynik i dziesięć dowodów uzupełniono po końcowym przebiegu.

### Wynik końcowy — pełny zakres §0.4a (Z23)

Zakres: **16 plików testowych; 10 PASS / 6 FAIL**. Test cases: **90 PASS / 16 FAIL / 19 skipped** (125 łącznie, 106 wykonanych).

- czerwone ZASTANE: `adminP32.security-audit.test.ts` 1/1 FAIL; `tests/integration/admin` 5/8 plików FAIL, 15 testów FAIL. Identyczny wynik baseline i final.
- czerwone WPROWADZONE: **PUSTE**.
- nowe/bezpośrednie: Day 22 RealPG 9/9 PASS; istniejące break-glass/service-account 9/9 PASS; obie bitowo niezmienione projekcje RealPG 1/1 + 1/1 PASS.
- `ZASIĘG PEŁNY` dla literalnej listy §0.4a. Skipped 19 raportowane, nie liczone jako PASS.

### Dziesięć dowodów Bloku 6

1. Globalna infrastruktura testów: diff pusty.
2. `src/`: diff pusty.
3. `organizationSuspensionGuard.ts`: diff pusty.
4. Osiem frontów DEC-105: diff pusty.
5. `effectiveAccessService.ts`: diff pusty.
6. `auditLog.middleware.ts`, `requireAudit.middleware.ts`, `adminAuditService.ts`: diff pusty.
7. Dwa zastane testy projekcji: diff pusty.
8. Migracje: diff pusty.
9. Flagi: kod produkcyjny pusty; grep całego diffu trafia wyłącznie cytat komendy w wiążącej instrukcji obecnej na gałęzi instrukcyjnej, nie zmianę runtime.
10. Kontener i wolumeny: pusto. Usunięto `cx-day22-pg`; `docker volume prune -f` odzyskał 665,9 MB.

## TRI-MUST-08 — stan w liczbach

Przed: **20/83 = 24,1%** pisarzy semantycznych widzianych przez projekcję.
Po: **24/83 = 28,9%**. Tabele w projekcji: **3/5 celowo**; nogi 4/5 nie dają nowych zdarzeń i powodują duplikację.
Werdykt AC-005: **PARTIALLY PROVEN**. Cztery najwyżej ryzykowne trasy rankingu 1–2 mają semantyczny audyt i realdb readback; uniwersalność 83/83 nie jest dowiedziona.

## Czego nie zrobiłem

Nie rozszerzyłem rankingu 3–5, SuperAdmin projection, audytu odmów ani frontu. Nie dodałem migracji, flag ani fikcyjnych wpisów. Nie deklaruję 5/5 przez potrojenie zdarzeń. Materiał jest gotowy do odbioru przez nadzorcę, nie do pokazania właścicielowi.
