# DYŻUR 67 — TEST DEBT P2 — RAPORT

## Status

`PARTIAL`. Samopoprawa zamknęła kolejne przyczyny P2 bez zmian produktu. Końcowy izolowany mianownik po wszystkich naprawach: 49 istniejących, unikalnych plików; 20 zielonych i 29 czerwonych. Każdy z 29 pozostałych plików ma niżej pełną klasyfikację oraz nazwany plik właścicielski. Nie ma podstaw do wpisania `FIXED` dla całego P2 ani B9.

## Rodowód i korekta instrukcji

- marker i baza: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`;
- tip wydanej instrukcji: `654ae1daf966e0fbc597faf103dd563b038d9eaa`;
- gałąź: `codex/day67-test-debt-p2-20260828`;
- vault/remote: `consultify-recovery-vault-20260820.git` / wyłącznie `github-backup`;
- instrukcja zawiera sprzeczne wpisy `p6` w §1, §2 i §6 oraz `p2` w nazwie, raporcie i bloku PG. Zastosowano jawnie wydaną przez nadzorcę tożsamość P2. To korekta autora instrukcji, nie rozszerzenie licencji.

`git merge-base --is-ancestor 6868d57... github-backup/codex/m03-admin-20260824` → exit 0. Tip bazy był równy markerowi. Przed pracą `git status --short` był pusty. Wolne miejsce: 66.5 GB.

## Ponowny mianownik P2

Parser zakresu między nagłówkami P2/P3 w `TEST_DEBT_DAY59_MAPA.md`, następnie `sort -u`, kontrola `-f` i dopisanie obowiązkowego pinu Harvard:

| liczba | znaczenie | wynik |
| ---: | --- | --- |
| 48 | ścieżki z listy P2 | 48 unikalnych, 0 brakujących |
| 49 | kontrakt po dodaniu `harvardCrossModuleFlows.test.ts` | 49 unikalnych, 0 brakujących |
| 20 | zielone pliki w końcowym rerunie izolowanym | exit 0 |
| 29 | czerwone pliki w końcowym rerunie izolowanym | exit 1 |

Każdy plik uruchomiono osobnym procesem z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5939/cx_day67_testdebt JWT_SECRET=test-debt-day67-local-only-secret-32chars-min` i `--retry=0`. Zbiorczy równoległy przebieg odrzucono jako diagnozę, ponieważ suite'y wzajemnie usuwały fixture z jednej bazy.

Zielone końcowo obejmują poprzednie 8 oraz: `AuthController`, sześć testów tras z odświeżonymi lokalnymi mockami, trzy testy PDF, `helpChat.routes` i `adminSessionService`. `InitiativeController` pozostaje czerwony jako plik, ale trzy kontrakty transakcyjne przeszły z czerwieni na zieleń.

## Przyczyny i dowody mutacyjne

| pozycja / przyczyna | cofnięcie | przywrócenie | wynik |
| --- | --- | --- | --- |
| P2-MOCK-CONTRACT — niepełny mock `Logger` | 17/17 czerwonych, `default.info is not a function` | 17/17 zielonych | ZROBIONE |
| P2-MOCK-CONTRACT — brak `getCurrentPgTransactionClient` | 1/4 czerwony, `No getCurrentPgTransactionClient export` | 4/4 zielone | ZROBIONE |
| P2-PG-NORMALIZATION — SQLite-shape kontra realny PG | 4 czerwone: `expected null to be undefined`, `expected '2' to be 2` | 23/23 zielone | ZROBIONE |
| P2-RATE-LIMIT-CLOCK — globalny zegar psuty przed importem | 1 czerwony, `clock failure` z `moment/file-stream-rotator` | 36/36 zielonych | ZROBIONE |
| P2-ROUTE-MOCK-EXPORTS — sześć lokalnych mocków nie eksportowało nowych middleware/validator/controller/DbPromise | 6 plików czerwonych; nazwane brakujące eksporty | 6 plików / 10 testów zielonych | ZROBIONE |
| P2-PDF-FONT-VM — zewnętrzny PDFKit/fontkit nie akceptował fontu przez granicę VM Vitest | 3 pliki / 6 nazwanych testów czerwonych | 3 pliki / 13 testów zielonych | ZROBIONE; testy zachowują walidację binarną, nie dowodzą osadzenia polskich glifów |
| P2-ORG-CLEANUP-FK — cleanup usuwał `system` wskazywany przez `users.organization_id` | nazwany test czerwony na `users_organization_id_fkey` | ten sam test zielony; dalsze fixture tego pliku sklasyfikowane niżej | ZROBIONE dla cleanupu |
| P2-MFA-MOCK — brak `createLoginChallenge` | nazwany test MFA czerwony | 7/7 zielonych | ZROBIONE |
| P2-INITIATIVE-TX-MOCK — brak `withPgTransaction` | trzy nazwane testy czerwone na brak eksportu | te trzy zielone; 6 innych nadal czerwonych | ZROBIONE dla przyczyny transakcyjnej |
| P2-HELP-ERROR-CONTRACT — test oczekiwał wycieku komunikatu wyjątku | nazwany test czerwony | 7/7 zielonych na generycznym komunikacie | ZROBIONE; zamierzone zachowanie bezpieczeństwa |
| P2-ADMIN-SESSION-PARAM — asercja wskazywała indeks tokenu zamiast `expires_at` | nazwany test czerwony | 2/2 zielone | ZROBIONE; asercja nadal sprawdza ścisłą datę |

Wspólny regres sześciu plików po naprawach, wraz z Harvard: 6 plików / 102 testy zielone, `--retry=0`.

## Zmiany istniejących testów i werdykt pin-buga

| plik / asercja | było | jest | werdykt |
| --- | --- | --- | --- |
| `queryHelpers.test.ts` mock loggera | `error`, `warn` | plus `info`, `debug` | zamierzone zachowanie; pełny kontrakt zależności |
| `r1-context-pack.test.ts` mock queryHelpers | brak eksportu | `getCurrentPgTransactionClient → undefined` | zamierzone zachowanie; brak aktywnej transakcji w teście |
| `taskService.test.js` / brak wiersza | `undefined` | `null` | zamierzone zachowanie realnego PG |
| `taskService.test.js` / `COUNT(*)` | ścisłe `2` | `Number(count) === 2` | zamierzone zachowanie parsera `int8` PG; wartość nadal ścisła |
| `userService.test.js` / brak wiersza (2 asercje) | `undefined` | `null` | zamierzone zachowanie realnego PG |
| `rateLimiting.middleware.test.ts` | spy `Date.now` przed importem | spy po imporcie, przed wywołaniem limitera | zamierzone zachowanie; fault injection mierzy limiter, nie logger |
| sześć testów tras | brak nowych eksportów w lokalnych mockach | komplet eksportów wymaganych przez importowane trasy | zamierzone zachowanie; asercje bez zmian |
| trzy testy PDF | realny font przez granicę VM Vitest | lokalny Standard-14 Helvetica | zamierzone środowisko testowe; asercje binarne bez zmian, osadzenie polskich glifów `NOT_PROVEN` |
| `AuthController.test.ts` | brak challenge API | lokalny `createLoginChallenge` | zamierzone zachowanie; asercja MFA bez zmian |
| `helpChat.routes.test.ts` | oczekiwany surowy `AI unavailable` | generyczny `HelpChat request failed` | zamierzone zachowanie bezpieczeństwa, nie osłabienie |
| `adminSessionService.test.ts` | indeks `3` (token) | indeks `4` (`expires_at`) | korekta pola; ścisła data bez osłabienia |

### Obowiązkowy pin Harvard B9

Werdykt: **KANONIZACJA DZIURY**. Asercja `expect(stubs).toEqual(expect.arrayContaining(['B9']))` wymusza pozostanie B9 w stanie `stub`. Dokładny plik produktu wymagający zmiany to `server/src/services/tablePlatform/ModuleSyncService.ts`; kanon w `server/scripts/harvard-cross-module-flows.ts` potwierdza zapis wyłącznie metadanych do `tp_module_sync_results`. Brakuje konsumentów/read-back w Results (M15), Finance (M16) i Execution/Initiatives (M14). Minimalny przyszły dowód: zapis przez realny Gateway z podpisanym JWT i membership, niezależny odczyt skutku biznesowego w każdym z trzech modułów na tym samym tenantcie oraz negatywny odczyt z drugiego tenantu, real-PG, `--retry=0`. Izolowany pin ma 22/22 zielone, ale nie dowodzi handoffu. Status produktu: `NOT_AUTHORIZED`; B9 nie jest `FIXED`.

## Kompletna klasyfikacja pozostałych 29 czerwonych plików

„Właściciel” oznacza minimalny plik potrzebny do prawidłowej naprawy, a nie zgodę na jego zmianę. `Poza P2` wskazuje nazwany kontrakt produktu; `P2` wskazuje dalszy dług w licencjonowanym teście, którego nie wolno relabelować jako zamknięty.

| plik | pełne nazwy czerwonych testów | pierwsza przyczyna / kategoria | właściciel | werdykt |
| --- | --- | --- | --- | --- |
| `agentProductionBuildBoundary.test.ts` | `Agent production build boundary > runs the packaged strict Postgres migrator before the Railway API starts`<br>`Agent production build boundary > uses the fail-hard production project for the public backend build command` | kanon skryptów build/release różni się od oczekiwań; produkt | `server/package.json`, `railway.toml` | poza P2; replacement: decyzja właściciela release |
| `aiActionExecutor.wave3-runtime.test.ts` | `AIActionExecutor Wave 3 runtime lifecycle > creates an AIRun proposal and does not mutate before explicit approve and execute` | kształt argumentów akcji zmienił kolejność/semantykę; produkt | `server/src/services/aiActionExecutor.ts` | poza P2; replacement: kanoniczny kontrakt AIRun |
| `DecisionController.test.ts` | `DecisionController > createDecision > should create decision with valid data`<br>`DecisionController > decide > allows OWNER auth alias to approve decisions they do not own directly`<br>`DecisionController > decide > should approve decision with rationale`<br>`DecisionController > decide > should reject decision with rationale`<br>`DecisionController > updateDecision > persists explicit status updates instead of silently ignoring them` | mocki zapytań/asercje nie odpowiadają bieżącemu workflow decyzji; test | ten plik oraz, dla decyzji semantycznej, `server/src/controllers/DecisionController.ts` | P2; replacement: zaakceptowany kontrakt kontrolera |
| `InitiativeController.test.ts` | `InitiativeController > createInitiative > should return 400 when title missing`<br>`... > should store JSON arrays for deliverables and risks`<br>`InitiativeController > updateInitiative > should update initiative`<br>`InitiativeController > updateInitiativeStatus > (4) handoff failure does NOT block the status change (fail-safe)`<br>`... > invokes closure handoff (M14→M15) on EXECUTING → DONE`<br>`... > should block DONE -> TRACKING when Benefits KPIs are missing` | po naprawie transakcji: 422 zamiast 400, nowy capability context, benefits-owner gate i zmieniona sekwencja handoff; produkt/test | ten plik; `server/src/controllers/InitiativeController.ts`; `server/src/services/initiative/initiativeTransitionService.ts` | mieszane; replacement: kanon lifecycle M14 |
| `InterviewAssignmentsController.test.ts` | `InterviewController assignments > approveAssignment: stores manager vs AI decision memory`<br>`... > sendBackAssignment: reopens assignment as in_progress with feedback`<br>`... > submitAssignment: <50% stays submitted and remains reviewable`<br>`... > submitAssignment: >=50% still stays submitted (approval is separate)`<br>`... > submitAssignment: all-sufficient answers → 200, status flips, score persisted`<br>`... > submitAssignment: allows re-submit from an already submitted assignment`<br>`... > submitAssignment: notification to the sender carries the AI quality score`<br>`... > submitAssignment: zero-question session is NOT trapped by the AI floor (allowed)` | stary mock zapytań nie emuluje atomowej transakcji i `changes`; test | ten plik | P2; replacement: lokalny adapter klienta PG zachowujący kolejność wyników |
| `OrganizationController.audit.test.ts` | `OrganizationController audit proof (ADM-RAW-P1-004) > emits remove_member audit on a successful removal`<br>`... > emits update_member_role audit on a successful role change` | fixture sukcesu nie dochodzi do aktualnego emitera audytu; test/produkt | ten plik; `server/src/controllers/OrganizationController.ts` | mieszane; replacement: kontrakt audytu ADM |
| `adminAudit.emission.test.ts` | `Admin audit emission (BUG A / H2.12) > emits remove_member on a successful member removal`<br>`... > emits update_member_role with correct action + actor on a role change`<br>`... > is fail-safe: audit throwing does NOT block the role change (still 200)` | stary mock API kontrolera omija bieżącą ścieżkę sukcesu; test | ten plik | P2; replacement: aktualny fixture OrganizationController |
| `database/mockDatabase.test.ts` | `mock Database > reads mock table columns through dbSchema helper`<br>`mock Database > updates and reads my_idea_maps rows by composite key with select aliases` | obowiązkowy real-PG uruchamia test kontraktu mock DB; środowisko/test | ten plik | P2; replacement: lokalna jawna instancja mock bez globalnego przełączenia |
| `generateDeliverable.canvasTools.test.ts` | `generate_deliverable(type:note) > creates a real notebook page and emits onDeliverable with the DB id when the flag is ON` | zmieniona flaga/ścieżka notebook persistence; produkt | `server/src/services/ai/tools/generateDeliverableTool.ts` | poza P2; replacement: kanon note/notebook |
| `harvardModuleContract.test.ts` | `Harvard module contract — every module has a mounted backend > M07 Ideas — Process Flow — primary endpoint base is mounted in the route layer` | brak mountu `/api/v8/process-flow/contract`; produkt | `server/src/index.ts` i właściwa trasa Process Flow | poza P2; replacement: realny mount/read-back |
| `apiKeyAuth.middleware.test.ts` | 18 kontraktów pod `apiKeyAuth.middleware (L1)`: `accepts API key from Authorization header array and x-forwarded-for array`; `accepts Authorization bearer token with surrounding whitespace around ck key`; `accepts IPv4-mapped IPv6 forwarded IP when whitelist contains plain IPv4`; `authenticates with Authorization: Bearer ck_<key> and attaches req.apiKey + req.organizationId`; `cleans up old per-key rate limit entries periodically`; `enforces per-key rate limit and returns 429 on excess`; `falls back to query api_key when headers accessor throws`; `falls back to socket.remoteAddress for client IP when other fields are missing`; `hybridAuth uses API key when present, otherwise falls back to JWT middleware`; `optionalApiKeyAuth continues when key missing, but validates when present`; `rate-limited response includes no-store cache headers`; `rejects when client IP is not on whitelist`; `requireApiKeyPermission allows when FULL_ACCESS is present`; `requireApiKeyPermission allows when permission is present`; `requireApiKeyPermission blocks when missing or lacking permission`; `returns 500 when response header setting throws`; `supports X-API-Key header and falls back to req.ip for client IP`; `supports api_key query parameter` | mock DB callback API nie odpowiada bieżącemu Promise API; test | ten plik | P2; replacement: aktualny lokalny mock DbPromise |
| `orgContext.middleware.test.ts` | `allows write fallback when strictWrite=false (uses user default)`; `attaches org context for ACTIVE membership (url param)`; `falls back to MEMBER role when membership role contains control characters`; `falls back to user default org when header accessor throws and strictWrite=false`; `falls back to user default org when x-org-id header value accessor throws and strictWrite=false`; `getUserOrganizations returns unique orgs with access types`; `ignores header when allowHeader=false and uses user default org for reads`; `ignores inherited orgId in req.params prototype and requires explicit own param`; `resolveUserOrgAccess returns consultant access when ACTIVE link exists`; `resolveUserOrgAccess returns membership access when ACTIVE member exists`; `resolves header org when custom headerName uses mixed case`; `returns 400 invalid organization id when URL org is malformed even if header conflicts`; `returns 400 when URL org and header org conflict under allowHeader=true`; `returns 400 when header array contains conflicting org ids`; `returns 403 when consultant permission_scope JSON is invalid`; `returns 403 when membership permission_scope JSON exceeds max safety length`; `returns 403 when membership permission_scope JSON is invalid`; `returns 403 when membership permission_scope contains disallowed object keys`; `sanitizes whitespace-padded membership role before attaching org context`; `supports allowHeader=true to read orgId from header`; `supports consultant access via consultant_org_links`; `uses first header value when header is an array`; `uses last_selected_org fallback when organizationId is missing`; `uses legacy organization_id fallback when organizationId is missing` | po naprawie cleanupu: brak fixture użytkowników dla FK oraz role celowo niezgodne z realnym CHECK; dane/test | ten plik | P2; replacement: real-PG user fixtures; przypadki nielegalnych ról wymagają jawnego unit mocka |
| `notificationService.test.js` | `NotificationService > Mark All Read > should mark all notifications as read`<br>`NotificationService > Notification CRUD > should delete notification`<br>`NotificationService > Unread Count > should count unread notifications` | SQLite-shape: `null/undefined` i `int8` string; dane/test | ten plik | P2; replacement: normalizacja real-PG |
| `organizationService.test.js` | `OrganizationService > AI Settings > should get default AI settings`; `... > should update AI settings`; `OrganizationService > addMember > should add a member to organization`; `... > should reject invalid roles`; `... > createOrganization > should add creator as OWNER member`; `... > should create a new organization`; `... > should store organization in database`; `... > getMembers > should return organization members`; `... > getOrganization > should return organization by ID`; `... > getUserOrganizations > should return user organizations`; `... > removeMember > should remove member from organization`; `... > updateMemberRole > should update member role` | fixture/schema zakłada SQLite i koliduje z pełnymi FK/CHECK PG; dane/test | ten plik | P2; replacement: tenant-safe fixture real-PG |
| `permissionService.test.ts` | `PermissionService > Database-Backed PBAC > hasPermission() > should check explicit GRANT override`<br>`PermissionService > Multi-Tenant Isolation > should not allow user from Org A to access Org B permissions` | mock wyników nie odpowiada bieżącym zapytaniom PBAC; test | ten plik | P2; replacement: aktualny query fixture |
| `accessRoleBuilder.security.test.ts` | `access role builder guardrails > clone-on-writes factory template instead of mutating it` | asercja SQL nie uwzględnia bieżącego zapisu klonowania; test/produkt | ten plik; właściwa trasa access-role-builder | mieszane; replacement: kanon clone-on-write |
| `adminP32.security-audit.test.ts` | `PUT /api/admin/security — audit emission (BUG A / H2.12) > emits update_security_policy with the acting admin + org` | nowa bramka roli zwraca 403 przed fixture sukcesu; test | ten plik | P2; replacement: aktualny mock RBAC/membership |
| `document-studio.routes.leak-guard.test.ts` | `document-studio /templates/:templateId/approve — 500-leak guard > does NOT echo a raw/unexpected exception message to the client` | fixture trafia 404 przed gałęzią leak-guard (oczekuje 400); test/produkt | ten plik; `server/src/routes/documentStudio.routes.ts` | mieszane; replacement: istniejący template fixture i kanon błędu |
| `h64-failsoft-batch6.test.ts` | `/api/table-platform/tables/:tableId/records/batch — write stays fail-closed (H6.4 batch6) > POST ... outer-scope throw: 500 + code, no err.message leak`<br>`... > per-item failure stays inside results (200), no crash` | mock starego API nie wchodzi w bieżące gałęzie fail-soft/fail-closed; test | ten plik | P2; replacement: aktualny route-local mock |
| `metricsOrgRoutes.test.ts` | sześć nazw: `Metrics Organization Routes > GET /api/metrics/org/ai-analytics > should return AI analytics`; `... > should return empty data when no AI usage`; `... /help > should return help metrics`; `... /overview > should return 500 on service error`; `... /overview > should return organization overview metrics`; `... /team > should return team metrics` | wszystkie zatrzymane 401 przez aktualny auth/membership; test | ten plik | P2; replacement: jawny lokalny auth fixture |
| `artifactRegistryService.test.ts` | `artifactRegistryService > uses canonical deck_json cards over a stale materialized slide_count` | importowany `resolvePresentationSlideCount` nie istnieje; produkt | `server/src/services/v8/artifactRegistryService.ts` | poza P2: martwy kontrakt albo brak produktu; replacement wymaga decyzji właściciela i implementacji/wycofania API |
| `documentBlockProseGenerator.warnings.test.ts` | `generateBlockProse + generation warnings > records llm_prose_fallback and returns stubs unchanged when the LLM throws` | produkt celowo sanitizuje warning i nie przenosi `provider down`; produkt/test | ten plik; generator prose | mieszane; replacement: kanon bez wycieku provider error |
| `generateDeliverableTool.test.ts` | `generate_deliverable tool (SPEC_01 Tryb A) > maps sheet → sheet and presentation → deck with a default deck setup` | domyślny audience jest `executive`, test oczekuje `internal`; produkt | `server/src/services/ai/tools/generateDeliverableTool.ts` | poza P2 do decyzji semantycznej; replacement: SPEC_01 audience canon |
| `presentationGeneratorService.evidencePersist.test.ts` | `presentationGeneratorService.generateDeck — HP-17 evidence persist > persists the deck EvidenceContract as an EvidenceEnvelope (artifactType=deck)` | stary mock deck document zwraca strukturę bez oczekiwanego slajdu; test | ten plik | P2; replacement: kompletna lokalna fixture deck document |
| `presentationGeneratorService.narrativeExtended.test.ts` | trzy nazwy: `... > ENABLE_DECK_NARRATIVE_EXTENDED='false' reverts to legacy gate: root_cause is skipped`; `... > default (flag unset = ON): root_cause slide reaches generateNarrative and gets _narrative_enrichment`; `... > folds the outline item keyMessage + dataNeeded into user_instruction for generateNarrative` | ten sam niepełny mock slajdu (`customTemplate` na undefined); test | ten plik | P2; replacement: aktualna fixture outline/deck document |
| `systemAlertNotifier.test.ts` | `systemAlertNotifier > dispatches a system alert to Slack and WhatsApp`<br>`systemAlertNotifier > throttles repeated alerts for the same key` | stare mocki routerów/persistence nie odpowiadają bieżącemu dispatch/dedupe; test | ten plik | P2; replacement: aktualny lokalny notifier fixture |
| `slackRouter.test.ts` | `slackRouter.routeToSlack > dedupe SURVIVES a simulated process restart (durable, DB-backed)` | realna baza zachowuje poprzedni webhook/dedupe między fazami fixture; dane/test | ten plik | P2; replacement: unikalny klucz i izolowany cleanup PG |
| `subscriptionAnalyticsService.test.ts` | kolekcja pliku: `tests/unit/backend/subscriptionAnalyticsService.test.ts` (brak zebranych testów) | import nieistniejącego serwisu; produkt | `server/src/services/subscriptionAnalyticsService.ts` | poza P2: martwy kontrakt albo brak produktu; replacement wymaga decyzji/implementacji |
| `wave8AgentRuntimeService.test.ts` | siedem nazw `Wave 8 agent runtime > blocks tool misuse and swarm without approval and budget gate`; `... > enforces approvalPolicy and processes due schedules`; `... > enforces tool scope before executing agent tools`; `... > exposes a complete specialized agent catalog with scoped tools and schemas`; `... > launches role-specific schema-valid output and creates owner-audited schedules`; `... > records eval run hooks as audit-only hooks without executing an evaluator`; `... > stores admin-editable AgentDefinition overrides in the Wave 8 database catalog` | zapis schematu runtime kończy się `wave8_schema_write_failed`; produkt/schema | `server/src/services/wave8AgentRuntimeService.ts` i istniejąca migracja schematu | poza P2; replacement: właścicielski real-PG schema contract |

Nie zmieniono asercji tylko dla zieleni. Pełne logi każdego pliku są zachowane w `/private/tmp/consultify-day67-test-debt-p2-artifacts/final-isolated/`.

## Migracje, PG, kompilacje i osiągalność

- własny kontener: `cx-day67-pg`, `127.0.0.1:5939`, baza `cx_day67_testdebt`;
- pierwszy przebieg istniejących migracji: 862, exit 0; drugi: `Applying migrations: 0`, exit 0;
- utworzone migracje: 0; rezerwacja `20261670-20261679` nieużyta;
- serwer: `NODE_OPTIONS=--max-old-space-size=3072 ../node_modules/.bin/tsc --build tsconfig.build.json --force` → exit 0. Zamiast kasować `dist` przeniesiono zastany katalog do scratch; kompilacja była wymuszona `--force`;
- frontend: `NODE_OPTIONS=--max-old-space-size=6144 npm run build` → exit 0;
- HTTP: `NIE DOTYCZY` — wszystkie zmiany dotyczą wyłącznie licencjonowanych testów; brak zmiany trasy runtime.
- artefakty final-isolated zachowane w `/private/tmp/consultify-day67-test-debt-p2-artifacts/final-isolated/`; SHA-256 manifestu per-log `b4e6fdd8c0a5e9d09e872a291a1fcee6258204a23e4bd02dabc454dd73e9f336`, summary `b6fa3977977056e0031889a92eb67235f2e000e4cfd06a8c3500ce7d174508ba`, server build log (poprawnie pusty) `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, frontend build log `f5acbe3108d0069b5cd70c410f37585ce957d28802494bbbe96d7ec362f4c8ec`.

## Commity i push

| commit | przyczyna | push github-backup |
| --- | --- | --- |
| `4cf4d9a2b4` | P2-MOCK-CONTRACT | TAK, natychmiast po pierwszym commicie |
| `b6e1e91c2c` | P2-PG-NORMALIZATION | TAK |
| `5f391085c9` | P2-RATE-LIMIT-CLOCK | TAK |
| `5f3d7776ec` | route-local runtime mocks | TAK |
| `e8b51c8c75` | PDF font fixtures | TAK |
| `0f36701419` | org cleanup FK | TAK |
| `ed2f9e1344` | MFA challenge fixture | TAK |
| `9e9ea4336e` | initiative transaction fixture | TAK |
| `94951ca717` | HelpChat security + admin session parameter fixtures | TAK |

## Kontrola diffu

Przed każdym commitem kontrolowano diff i `git diff --check`. Zapisano wyłącznie licencjonowane pliki P2 oraz ten raport. `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, migracje i produkt pozostały bez zmian. Nie użyto `.skip`, `.todo`, wyciszeń TS/ESLint, zmian progów, exclude ani stash.

## KARTA DOWODOWA — DYŻUR 67 (TEST DEBT P2)

Gałąź: `codex/day67-test-debt-p2-20260828`  Marker: `6868d57...`  Data: `2026-08-28`

1. Rodowód: marker przodkiem tipa TAK; kopia po pierwszym commicie TAK (`4cf4d9a2b4`). Finalny tip jest podany w oddaniu po utworzeniu i wypchnięciu commita raportu; wpisanie SHA własnego commita do jego zawartości jest kryptograficznie niemożliwym samoodwołaniem.
2. Rozłączność: pliki spoza licencji ŻADNE; migracje 0; PG/harness 5939/3997 (harness nieużyty).
3. Osiągalność: NIE DOTYCZY — brak zmian runtime.
4. Mutacje: cztery wiersze w tabeli powyżej, każda czerwony→zielony.
4b. Kompilacja: serwer exit 0; frontend exit 0.
5. Regres: 49 plików izolowanych, `--retry=0`; końcowo 29 czerwonych plików i 20 zielonych według pliku statusowego.
6. Zmiany testów: sześć zmian asercji/mocków, wszystkie „zamierzone zachowanie”; Harvard B9 = kanonizacja dziury, bez osłabienia.
7. Mianowniki: tabela w sekcji „Ponowny mianownik P2”.
8. Wygląd: NIE DOTYCZY; brak zmian widocznych.
9. Status: kolejne przyczyny P2 ZROBIONE; cały P2 CZĘŚCIOWO; B9 `NOT_AUTHORIZED` do implementacji produktu.
10. Twierdzenia niezweryfikowane: realna osiągalność B9; wpływ integracji P1/P3-P6; globalny regres repo; aktualność skryptów release jako decyzji właściciela.
11. STOP-y: brak licencji na źródła przekrojowe/produktowe potrzebne dla B9, build/release, fontów i części schema runtime. Potrzebna osobna licencja właściciela, nie rozszerzono P2.

## TWIERDZENIA NIEZWERYFIKOWANE

- `NOT_PROVEN`: globalna zieleń P1/P3-P6.
- `NOT_PROVEN`: B9 ma realnego konsumenta lub read-back — aktualne dowody mówią przeciwnie.
- `PARTIAL`: 29 czerwonych plików ma pełną klasyfikację; część dalszych poprawnych zmian nadal mieści się w P2 i nie została zamknięta.
- `EVIDENCE_MISSING`: decyzja właściciela, czy obecne komendy build/release są kanonem, czy regresją.
- `NOT_AUTHORIZED`: implementacja źródeł produktu poza P2.
