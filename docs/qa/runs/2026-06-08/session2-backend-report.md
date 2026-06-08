# Raport backendu — Session 2 (analiza prod dla raportu testera)

⚠️ **Środowisko: PRODUKCJA.** `consultify.ai` = `consultify-production.up.railway.app` (`environment: "production"`, db+redis connected). Tester Session 2 działał na **prodzie** jako USER `userId 3dd1179b-7bfb-4192-9e55-e776d88d2d23`, org slug **`vts`** (VTS GROUP S.A.). To znacząco podnosi wagę — na prodzie idzie rollout VTS (~131 osób).
Źródła: kod serwera (cytaty file:line) + logi Railway prod (okno ~19:34–19:38 UTC, 2026-06-08).

## Werdykty per BUG (z raportu testera)

### BUG-14 (429 cascade) — REKLASYFIKACJA: przyczyna FRONTEND, nie serwer · P1
- **Serwer jest OK:** globalny limiter `app.use('/api/', apiLimiter)` (`server/src/index.ts:980`), Redis-backed, **1000 req/15 min na użytkownika** w prod (`server/src/utils/apiLimiterPolicy.ts:25-32`), klucz per-user; `/api/health` i `/api/auth/*` wyłączone (`index.ts:145-148,799`).
- **Prawdziwa przyczyna — frontendowy circuit breaker** w `src/services/api.ts`: po **2 błędach (429/5xx) w oknie 8 s** (`GLOBAL_TRANSPORT_FAILURE_THRESHOLD=2`, `…WINDOW_MS=8000`, `api.ts:86-87`) front **sam syntetyzuje 429** (`buildGlobalBlockedResponse`, `api.ts:233-243`) dla wszystkich niewyłączonych `/api/` na **5 minut** (`GLOBAL_TRANSPORT_BLOCK_MS=300000`, `api.ts:88`), zapis w sessionStorage (przeżywa reload/taby). Lista bypass (`api.ts:267-282`) nie obejmuje `organizations/current`, `my-work/radar`, `preferences`, `notifications`, `v10/teresa/voice-config` — dokładnie te, które tester widział jako 429.
- **Dowód z logów:** w oknie testu **brak 429 po stronie serwera** → kaskada jest klient-side. Potwierdza diagnozę.
- **Skutek:** 2 realne 429/5xx w 8 s → 5-minutowy „blackout" całej apki. Naprawa = poluzować próg/okno breakera (2/8s jest skrajnie agresywne), nie limiter serwera.

### BUG-02 (chat 403) + BUG-15 (voice „no longer have access") — WARUNKOWE/PRZERYWANE · P1
- **Wspólna przyczyna kodowa:** `POST /api/conversations` przechodzi przez `orgMembershipGuard`=`validateOrgMembership` (`Gateway.ts:471,307`). 403 `ORG_MEMBERSHIP_REVOKED` rzucany w `auth.middleware.ts:1383-1407`, gdy brak wiersza w `organization_members` ze `status='ACTIVE'` dla rozwiązanego org (`:1394-1402`; cache 60 s `:1380`, fail-open na błąd DB `:1411-1418`).
- **ALE logi prod (19:38) pokazują, że czat DZIAŁAŁ:** ten sam user `3dd1179b`/org `vts` utworzył rozmowę i czatował — `POST /api/conversations` → 200, `…/messages` → 200, `…/title/generate` → 200. Czyli **403/voice nie są globalną blokadą** — są warunkowe (zależne od kontekstu org / statusu membership w danym momencie). Najpewniej **ścieżka voice rozwiązuje inny/pusty kontekst org** niż czat tekstowy → 403 tam, gdzie tekst przechodzi.
- **Rekomendacja:** zweryfikować rozwiązywanie `organizationId` w ścieżce TeresaVoice/ConversationStore; ujednolicić z czatem tekstowym; komunikat „You no longer have access" jest mylący (user jest zalogowany i aktywny).

### BUG-05 (Interview — 4 zakładki 403) — RBAC, prawdopodobnie zamierzone · P2
- **Potwierdzone w logach prod:** dla USER `3dd1179b`/org `vts` → **403** na `/api/v8/interview/insights`, `/api/v8/interview/sessions/managed` **oraz** fallbacki `/api/interview/insights`, `/api/interview/sessions/managed`. Wszystkie 403, `isError:true`.
- **Wniosek:** managed-sessions/insights są manager/admin-only; USER dostaje 403 zgodnie z RBAC. Problem jest **UX-owy** — front pokazuje „połamane" zakładki zamiast czytelnego „brak uprawnień".

### BUG-18 (data scoping — USER widzi cudze zadania + nazwiska) — REALNY wyciek · P1 (PII na prodzie)
- **Kod potwierdza brak skopowania po roli:** `GET /api/v8/execution-control/manager/lanes/:laneId/problems` (`server/src/routes/v8/execution-control.routes.ts:1418-1435`) bierze tylko `organizationId`, woła `getManagerProblems(orgId, laneId, projectId)` bez user-id/roli. `managerProblemsService.ts` skopuje wyłącznie `organization_id=$1` (`:65,88,112,136,154`) i LEFT JOIN `users` → `assignee_name = first_name||' '||last_name` (`:83-86`, ekspozycja jako `ownerName`/`assignee` `:195,212,227,459`).
- **Skutek:** każdy członek org (w tym USER) widzi **wszystkie zaległe zadania org + prawdziwe nazwiska** pracowników. Na prodzie VTS = ekspozycja PII osobom bez uprawnień. **Najpoważniejsze nowe znalezisko.**
- (W oknie logów nie trafiono tego endpointu — potwierdzenie z kodu; do re-testu z włączonym logiem.)

### BUG-20 (`GET /api/integrations` 404) — stub w prod · P2/P3
- Handler istnieje (`integrations.routes.ts:494`), ale montowany przez `mountStub('/api/integrations', …)` (`Gateway.ts:543`), a `enableStubRoutes = !isProduction || ENABLE_STUB_ROUTES==='true'` (`Gateway.ts:333`). **W prod bez `ENABLE_STUB_ROUTES=true` baza `/api/integrations` nie jest montowana → 404** (`[ApiGateway] Stub route disabled in production`). Pod-ścieżki `/api/integrations/calendar` i `/automation` montują się normalnie (`Gateway.ts:523,527`) — działają. Niski wpływ.

### BUG-21 (`POST /api/analytics/web-vitals` 404) — brak route · P3
- **Potwierdzone w logach prod:** `POST /api/analytics/web-vitals → 404` (×2, user `3dd1179b`/org `vts`). `analytics.routes.ts` ma tylko `GET /health|/performance|/economics` — brak `web-vitals` i brak POST. Front wysyła telemetrię (`src/utils/webVitals.ts:373`) w próżnię. Metryki cicho gubione.

### BUG-22 (commandDock) — FRONTEND · P2
- Wyjątek rzucany na froncie: `cloneDefaultBlock('commandDock')` nie znajduje bloku w lokalnym `MOCK_SCREEN` (`src/components/MyWork/Home/useHomeData.ts:130,485,871`). Serwer **emituje** blok `commandDock` (`server/src/routes/my-work/home.routes.ts:1352`), front nie ma jego domyślnej definicji → throw. Fix po stronie frontu (dodać default `commandDock` lub guard na `.find`).

### BUG-13 (Settings sub-nav martwe) — FRONTEND · P1
- `src/components/Settings/SettingsSidebar.tsx:569,575` — sekcje przez stan rodzica (`activeSection`/`onSectionChange`), brak routingu per-sekcja i `<Route>`. Pod-ścieżki nie są podpięte do URL. Bez udziału backendu.

## Nowe znaleziska backendowe (z logów prod, nie z raportu testera)

### BUG-BE-S2-1 — Poważny N+1 / wydajność na prodzie · P2
- `POST /api/conversations/:id/title/generate` → **dbQueryCount=164, dbQueryTime=1637ms, responseTime=2110ms, isSlow:true** (org `vts`).
- Dodatkowo „High DB query count": `/api/conversations` (16), `…/messages` (22), `/api/v8/admin/flags` (24 — z Session 1).
- Generowanie tytułu rozmowy robi 164 zapytania — wyraźny N+1; na 131-osobowym rolloucie obciąży DB.

### BUG-BE-S2-2 — PRODUKCJA: drift schematu DB w pipelinie AI (26 błędów w buforze) · P1
Logi prod (org `vts`, user `3dd1179b`) pokazują wielokrotne twarde błędy Postgres w ścieżce AI:
- `column "internet_enabled" does not exist` — `SELECT internet_enabled FROM ai_policies WHERE organization_id=$1` (polityki AI).
- `relation "ai_user_style_profiles" does not exist` — `AdaptiveResponseService.getResponseConfig` (kod 42P01).
- `operator does not exist: integer = boolean` — zapytanie `llm_providers ⨝ llm_tier_assignments` (`p.is_active = 1` vs `mta.is_active = true`) → **`[AI:ModelRouter] Failed to get models for tier BUDGET`** → routing zjeżdża na **`config_service_fallback` (deepseek-chat)**, nie na konfigurację z DB.
- `column "error_message" of relation "ai_usage_logs" does not exist` — **INSERT do `ai_usage_logs` się wywala** → zużycie/tokeny **nie są ewidencjonowane**.
**Skutek:** czat odpowiada, ale routing modeli jest zdegradowany (hardcoded provider), ewidencja zużycia AI nie działa (ślepota na koszty/limity), a polityki AI (internet/style) błędują. Dla rolloutu 131 userów to istotne — brak token-accountingu i niespójna konfiguracja modeli. **Schemat prod wymaga migracji tak samo jak staging** (inny zestaw braków: `ai_policies.internet_enabled`, `ai_user_style_profiles`, `ai_usage_logs.error_message`, typy w `llm_providers`).

## Podsumowanie werdyktów
| BUG | Werdykt | Sev (prod) |
|-----|---------|-----------|
| 14 (429) | frontend breaker (2/8s→5min) — serwer OK | P1 |
| 02/15 (chat/voice 403) | warunkowy membership/kontekst org; czat tekstowy działał | P1 |
| 05 (interview 403) | RBAC by-design; problem UX | P2 |
| 18 (data scoping) | realny wyciek PII — brak skopowania po roli | **P1** |
| 20 (integrations 404) | stub wyłączony w prod | P3 |
| 21 (web-vitals 404) | brak route — potwierdzone w logach | P3 |
| 22 (commandDock) | frontend (brak default block) | P2 |
| 13 (settings nav) | frontend (brak routingu sekcji) | P1 |
| BE-S2-1 (perf 164 zapytań) | backend N+1 | P2 |
