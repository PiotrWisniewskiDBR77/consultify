# CODEX DAY 319 — zakres bezpiecznika DDL

Stan: **CZĘŚCIOWE**. Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`.

## Start

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

Tip `github-backup/grafika/m03-20260902` był o dwa commity dalej niż marker; różnica obejmowała wyłącznie instrukcje 319–321. Worktree celowo utworzono z markera.

## R1 — zakres bezpiecznika

Pomiar wejściowy: 504 wystąpienia w 160 plikach `server/src`; 197 w 98 plikach `server/src/services`. Bezpiecznik miał 79 wyjątków i skanował tylko `services`. Po zmianie skanuje `server/src`, jawnie nie czyta zakazanego `server/src/_backup`, pomija `__tests__` i ma 135 wyjątków.

Nowe pozycje zastanego długu poza `services` (właściciel kolejnego dyżuru schematowego; nieusunięte dziś, bo R1 zabezpiecza mianownik przed R2/R3):

| Plik | Liczba |
|---|---:|
| `server/src/controllers/DecisionController.ts` | 2 |
| `server/src/controllers/InterviewController.ts` | 8 |
| `server/src/controllers/SuperAdminController.ts` | 11 |
| `server/src/controllers/ToolController.ts` | 6 |
| `server/src/controllers/UserController.ts` | 1 |
| `server/src/cron/AIOpsReportCron.ts` | 1 |
| `server/src/database/DatabaseInitializer.ts` | 67 |
| `server/src/database/PostgresDatabase.ts` | 73 |
| `server/src/database/migrations/add_resource_tables.sql` | 2 |
| `server/src/index.ts` | 1 |
| `server/src/jobs/aiWatchdog.ts` | 2 |
| `server/src/middleware/demoGuard.middleware.ts` | 1 |
| `server/src/routes/admin/domains.routes.ts` | 1 |
| `server/src/routes/adminP32.routes.ts` | 8 |
| `server/src/routes/aiSettingsFallback.ts` | 1 |
| `server/src/routes/assessment-reports.routes.ts` | 3 |
| `server/src/routes/assessment/assessment-level-attachments.routes.ts` | 1 |
| `server/src/routes/assessment/assessment-workflow.routes.ts` | 3 |
| `server/src/routes/chat-projects.routes.ts` | 2 |
| `server/src/routes/client-errors.routes.ts` | 1 |
| `server/src/routes/compliance.routes.ts` | 1 |
| `server/src/routes/consultant-project-access.routes.ts` | 1 |
| `server/src/routes/discovery.routes.ts` | 1 |
| `server/src/routes/featureFlags.routes.ts` | 2 |
| `server/src/routes/featureUpdates.routes.ts` | 3 |
| `server/src/routes/feedback.routes.ts` | 4 |
| `server/src/routes/integrations/scim.routes.ts` | 5 |
| `server/src/routes/integrations/sso.routes.ts` | 1 |
| `server/src/routes/integrations/webhooks.routes.ts` | 1 |
| `server/src/routes/intelligence.routes.ts` | 2 |
| `server/src/routes/llm.routes.ts` | 7 |
| `server/src/routes/module-access.routes.ts` | 1 |
| `server/src/routes/organization/approved-domains.routes.ts` | 1 |
| `server/src/routes/organization/branding.routes.ts` | 1 |
| `server/src/routes/organization/organization-data.routes.ts` | 1 |
| `server/src/routes/organization/ownership.routes.ts` | 1 |
| `server/src/routes/organization/rbac.routes.ts` | 3 |
| `server/src/routes/pmo/pmoRoles.routes.ts` | 2 |
| `server/src/routes/pmo/workstreams.routes.ts` | 1 |
| `server/src/routes/public-contact.routes.ts` | 1 |
| `server/src/routes/resultsStrategic.routes.ts` | 5 |
| `server/src/routes/security/roles.routes.ts` | 1 |
| `server/src/routes/securityPolicies.routes.ts` | 1 |
| `server/src/routes/share.routes.ts` | 2 |
| `server/src/routes/superadmin.routes.ts` | 2 |
| `server/src/routes/systemHealth.routes.ts` | 1 |
| `server/src/routes/testSupport.routes.ts` | 11 |
| `server/src/routes/user/user-keyboard-shortcuts.routes.ts` | 1 |
| `server/src/routes/v8/execution-control.routes.ts` | 2 |
| `server/src/routes/v8/interview.routes.ts` | 4 |
| `server/src/routes/webhooks/stripe.routes.ts` | 1 |
| `server/src/routes/work-canvas.routes.ts` | 4 |
| `server/src/routes/workbook.routes.ts` | 1 |
| `server/src/scripts/a03PlanningClarificationRealDbProof.ts` | 2 |
| `server/src/scripts/t01FinalOutputRealDbProof.ts` | 7 |
| `server/src/utils/ensureUserOnboardingStatusTable.ts` | 1 |

Dowody mutacyjne, pełne wyjścia: `/private/tmp/cx-day319-ddl-zakres-artefakty/r1-mutacja-controller-red.txt`, `r1-mutacja-controller-green.txt`, `r1-mutacja-route-red.txt`, `r1-mutacja-route-green.txt`, `r1-mutacja-database-red.txt`, `r1-mutacja-database-green.json`. Mutacje: `AssessmentController.ts`, `health.routes.ts`, `ConnectionPool.ts`; wszystkie poza listą wyjątków i poza `services`. Po każdym cofnięciu diff pliku mutowanego był pusty.

```text
RED controller: + "server/src/controllers/AssessmentController.ts": 1; Tests 1 failed | 1 passed
GREEN controller: Tests 2 passed (2)
RED route: + "server/src/routes/health.routes.ts": 1; Tests 1 failed | 1 passed
GREEN route: Tests 2 passed (2)
RED database: + "server/src/database/ConnectionPool.ts": 1; Tests 1 failed | 1 passed
GREEN database: 2 assertionResults, oba status=passed
```

Porównanie nazw testów: zmieniła się wyłącznie nazwa przypadku zakresowego z `services` na `server/src`; test `AUTOINCREMENT` zachował nazwę i zakres `services`. Pliki: `/private/tmp/cx-day319-ddl-zakres-artefakty/przed-nazwy.txt`, `po-r1-nazwy.txt`.

Pułapki Z33: pakiet jest czysto plikowy, nie montuje `ApiGateway`, auth ani bazy. `RUN_DB_TESTS=0 MOCK_DB=true`; dowodzi wyłącznie statycznego zakresu strażnika. Nie jest dowodem egzekucji ani migracji.

## Korekty wobec instrukcji

- Pomiar 504/160 i 197/98 potwierdził liczby instrukcji.
- Po uruchomieniu własnego kontenera `lsof :6335` pokazuje proces tunelu Dockera; to oczekiwany własny listener, nie zajęty zasób wejściowy.
- R2: własna ścieżka realnego `ApiGateway` z rejestracją i pięcioma GET-ami zmaterializowała 7, nie 27 tabel. Wynik jest zależny od aktywowanych tras; wiążący jest zmierzony mianownik tej ścieżki.

## R2 — mianownik żywej pustej bazy

Strict chain: 891 migracji, drugi przebieg 0. Mianownik A po samych migracjach: 1907 tabel (`061054e05ab5a7808e5e5b882e243655998b203505e81fc4a963461b32cfbfb9`). Po realnym `ApiGateway`, `POST /api/auth/register` i pięciu GET-ach mianownik B: 1914 (`4b3938e035d2da62cf20c615d17b7b41c3b6115e31b1011ec763a3e54ca95fbf`). B−A: 7 (`6d4b040cc84cae3783b2886c09340aef78231923de2539c3b9c043341045e6ec`): `ai_ideas`, `ai_observations`, `mfa_attempts`, `project_role_overrides`, `project_role_templates`, `scheduled_emails`, `user_consents`.

Rejestracja zwróciła HTTP 200. GET-y: projects 200, notifications 200, access/effective 200, organizations/current 200, llm/providers 200. Surowy plik `r2-gateway-http.txt` zawiera efemeryczny JWT i nie jest w repo; raport nie publikuje tokena.

Klasyfikacja per tabela jest w rejestrze: 5 `MIGRACJA_POMIJANA`, 2 `BRAK_MIGRACJI`. Pełne listy i logi: `/private/tmp/cx-day319-ddl-zakres-artefakty/r2-tabele-A-migracje.txt`, `r2-tabele-B-runtime.txt`, `r2-roznica-B-minus-A.txt`, `migracje-wejscie-1.txt`, `migracje-wejscie-2.txt`.

Protokół Z30: `env` zwrócił `BRAK ZMIENNYCH POCZTY`; `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera startu drenażu. **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.** Log potwierdził `Using Host: Mock (Console)`.

Pułapki Z33: komplet env stał w tej samej linii (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny lokalny `DATABASE_URL`, `JWT_SECRET`). Harness montował `ApiGateway.getInstance().initializeRoutes(app)`, nie goły router i nie `server/src/index.ts`. Log zawiera `DB_IDENTITY ... 127.0.0.1:6335/cx319`.

## R3 — pokrycie migracyjne

Migracja `20261250_day319_runtime_ddl_gap.sql` addytywnie pokrywa wszystkie 7 tabel B−A. Pusta baza od zera przyjęła 892 migracje, drugi przebieg 0. `information_schema` po samym strict chain zwrócił każdą z siedmiu nazw. Dowody: `r3-migracja-1.txt`, `r3-migracja-2.txt`, `r3-tabele-po-migracji.txt`.

Po tym dowodzie usunięto 9 postgresowych DDL runtime: 5 z `PostgresDatabase.ts`, 2 z postgresowej gałęzi `DatabaseInitializer.ts` i 2 z `effectiveAccessService.ts`. Definicje SQLite w `DatabaseInitializer.ts` pozostają, bo `information_schema` dowodziło wyłącznie ścieżki PostgreSQL. Po usunięciu pusta baza ponownie przyjęła 892 migracje, drugi przebieg 0, wszystkie 7 tabel istniało, a bezpiecznik miał 2/2 PASS. Dowody: `r3-po-usunieciu-1.txt`, `r3-po-usunieciu-2.txt`, `r3-po-usunieciu-tabele.txt`, `r3-bezpiecznik-green.txt`.

## R4 — `llm_providers.markup_multiplier`

Zastany defekt nie pochodzi z dyżuru 310: kolumna nie powstawała ani w migracji, ani w runtime DDL. Kod jednak ją czytał/zapisywał w `AIPipeline.ts`, `modelRouter.ts`, `LLMController.ts`, `llm.routes.ts`, `llmConfigService.ts`, a ekran `AdminLLMMultipliers.tsx` oczekiwał jej w odpowiedzi.

PRZED: `information_schema.columns` miało 29 kolumn `llm_providers`, bez `markup_multiplier`; realny `GET /api/llm/providers` zwrócił 200, lecz obiekt providera nie zawierał pola. PO addytywnej migracji `20261251_day319_llm_provider_markup_multiplier.sql`: świeży strict chain 893/0, kolumna `real DEFAULT 2.0`, a ten sam realny GET zwrócił 200 z `"markup_multiplier":2`.

Wartość 2.0 zachowuje dotychczasowy fallback rozliczeniowy `AIPipeline` (kolumna → env → 2.0); 1.0 zmieniłoby cennik dla istniejących wierszy, więc nie zostało użyte jako default migracji. Jawny insert 1.0 w `llm.routes.ts` pozostał bez zmian. Dowody: `r4-kolumny-przed.txt`, `r2-gateway-http.txt`, `r4-migracja-1.txt`, `r4-migracja-2.txt`, `r4-kolumna-po.txt`, `r4-gateway-http-po.txt`.

## R5 — korekta rejestru 310

Bez kasowania historycznych wierszy dopisano dwie tabele statusowe: 11 rozstrzygniętych `ARTEFAKT_PARSERA` oraz 22/93 unikalne cytowane pliki jako `MIGRACJA_POMIJANA` wraz z regułą runnera. Detektor krótkich tokenów zwrócił 18 wierszy, z których 7 było prawdziwymi nazwami (`tasks`, `teams`, `users`) i celowo nie oznaczono ich jako śmieci. Pełna lista 22: `r5-migracje-pomijane.txt`.

## R6 — dowód końcowy

Kolejna pusta baza przeszła strict chain 893/0. Po samych migracjach miała 1914 tabel; po realnym `ApiGateway`, rejestracji i pięciu GET-ach nadal 1914. B−A jest puste. SHA-256 obu pełnych list jest identyczne: `4b3938e035d2da62cf20c615d17b7b41c3b6115e31b1011ec763a3e54ca95fbf`; SHA pustej różnicy: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

HTTP: `POST /api/auth/register` 200; `/api/projects` 200; `/api/notifications` 200; `/api/access/effective` 200; `/api/organizations/current` 200; `/api/llm/providers` 200 i `markup_multiplier:2`. W bazie nie było konfiguracji SMTP, transport pozostał `Mock (Console)`, a pełny serwer/drainery nie były uruchamiane.

```text
POST /api/auth/register 200 {"user":{"role":"ADMIN","emailVerified":false},"token":"[REDACTED_EPHEMERAL_JWT]","joiningExistingOrg":false,"promoApplied":null,"emailVerificationSent":true}
GET /api/projects 200 []
GET /api/notifications 200 []
GET /api/access/effective 200 {"effectiveAccess":{"applicationRole":"OWNER","capabilities":["*","admin.access","admin.people.manage","admin.project_roles.manage"],"scope":["organization"],"source":"resolved","warnings":[]}}
GET /api/organizations/current 200 {"organizations":[{"billing_status":null,"role":"OWNER","is_current":true,"access_type":"MEMBER"}]}
GET /api/llm/providers 200 [{"id":"vector-dbr77","provider":"dbr77","model_id":"vector-dbr77-beta","is_active":true,"cost_per_1k":0,"markup_multiplier":2,"is_configured":false,"is_enabled_for_org":true}]
```

Identyfikatory i JWT z surowego ciała zostały świadomie zredagowane w repo; pełny lokalny artefakt `r6-gateway-http.txt` ma SHA-256 `2c795c3d09e45b6cb9e9ddfe4895937f56d21f5a6d47f0841675b64b03b249c0` i nie jest publikowany.

Bezpiecznik: oba przypadki `passed`, `--retry=0`. Porównanie nazw PRZED/PO nie wykazało znikniętego testu; nazwa testu zakresowego uczciwie zmieniła `services` na `server/src`, drugi przypadek pozostał bez zmian.

| Miara | PRZED | PO |
|---|---:|---:|
| `CREATE TABLE IF NOT EXISTS` w `server/src` | 504 / 160 plików | 495 / 160 plików |
| w `server/src/services` | 197 / 98 plików | 195 / 98 plików |
| tabele B−A na zmierzonej ścieżce | 7 | 0 |
| migracje strict na świeżej bazie | 891 / 0 | 893 / 0 |

Funkcje, które nie działały poprawnie na czystej bazie przed tym dyżurem: trwałe oparcie `ai_ideas`, `ai_observations`, `mfa_attempts`, `project_role_overrides`, `project_role_templates`, `scheduled_emails`, `user_consents` o strict chain oraz pole narzutu `llm_providers.markup_multiplier` oczekiwane przez Admin. To zastane luki, nie regresje dyżuru 310.

## Commity

1. `731a297c78` — R1 zakres i mutacje.
2. `729c45efd9` — R2 mianownik.
3. `0829ac2664` — R3 migracja siedmiu tabel.
4. `b5ee3c38cf` — R3 usunięcie dziewięciu DDL PG.
5. `a2f4ddf13f` — R4 narzut LLM.
6. `a2a7be6ac6` — R5 rejestr.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zmierzono wszystkich możliwych ścieżek aktywacji 495 pozostałych DDL; liczba odbioru 27 nie została odtworzona i nie jest obalona globalnie.
- Nie dowiedziono zgodności kształtu 495 pozostałych DDL z migracjami.
- Nie mierzono SQLite po pozostawieniu jego dwóch definicji project-role w `DatabaseInitializer.ts`.
- Nie dotykano demo, stagingu ani produkcji; ich parity pozostaje `NOT_PROVEN`.
- Nie wywołano żadnego modelu LLM; nie mierzono realnego naliczania kosztu, tylko kontrakt kolumny i HTTP providera.
