# CODEX — DYŻUR 164 — „Agent nie wykonuje”

Data pomiaru: 2026-08-30  
Marker: `23bc57aaf3b16cfa1ced5cc1f8e11b1f7a2c9970`  
Branch: `codex/day164-agent-nie-wykonuje-20260830`  
Worktree: `/private/tmp/cx-day164-agent-nie-wykonuje`  
Wynik: **NIE AKCEPTOWAĆ WŁĄCZENIA — BLOCKED / REALNY DEFECT**

## 0. Zakres, izolacja i bezpieczeństwo

Instrukcję odczytano w całości z `github-backup/codex/m03-admin-20260824`, po `fetch github-backup --prune`. `git log -1 --format='%H' 23bc57aaf3` zwrócił dokładny marker. Worktree utworzono na markerze; początkowy `git status --short` był pusty. Wolne miejsce przed pracą: 14 GiB. Porty 6052, 4996 i 4997 były wolne. Użyto wyłącznie:

- PostgreSQL `pgvector/pgvector:pg16`: `127.0.0.1:6052`, kontener `cx-day164-pg`, baza `cx164`;
- Redis `redis:7-alpine`: `127.0.0.1:6394`, kontener `cx-day164-redis`;
- Vite: `127.0.0.1:4996`;
- port 4997 pozostał niewykorzystany, ponieważ nie uruchamiano pełnego `server/src/index.ts`.

Migracje od pustej bazy: pierwszy przebieg `868 applied`, drugi `0 applied`; oba zakończone powodzeniem. Logi: `/private/tmp/cx-day164-agent-nie-wykonuje-artefakty/migrations-run1.log` i `migrations-run2.log`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie uruchamiałem LLM ani dostawcy embeddingów. Nie łączono się z Railway ani zdalną bazą. Checkout właściciela nie był czytany ani modyfikowany; jedyny dozwolony kontakt to symlink `node_modules`.

## R1. Mapa „klik → plan → wykonanie → status → UI”

1. Wejście `/agent-plan` przekierowuje do `/my-work?tab=agent`; `MyWorkHub.tsx:218-219,4195` ładuje i renderuje `AgentHubShell`.
2. Flaga frontu jest domyślnie **ON**: `src/utils/agentPlanFlag.ts:42-44` zwraca `true`, gdy brak override. Komentarz w `routeConfig.ts:62` mówiący „default OFF” jest nieaktualny.
3. `AgentHubShell.tsx` tworzy draft planu; użytkownik uruchamia schemat w `AgentPlanPanel.tsx:369` przez `runAgentPlan`.
4. `POST /api/ai/agent-plan/:id/run` jest zamontowany przez `server/src/routes/ai/index.ts:81` w produkcyjnym `ApiGateway`; router zapisuje kroki i woła dispatch (`agent-plan.routes.ts:371-463`).
5. `dispatchAgentTask` tworzy trwały receipt, dodaje job BullMQ `AGENT_BACKGROUND_TASK` i zwraca stan kolejki (`agentTaskDispatchService.ts:56-121`). Gdy `ENABLE_AI_TASKS_WORKER` nie jest dokładnie `true`, zwraca `DISABLED` przed importem kolejki (`:59-62`).
6. Runtime workera ma osobną bramkę `ENABLE_AI_TASKS_WORKER` (`aiWorkerRuntime.ts:5,9-24`); scheduler i cron również respektują flagę (`agentPlanSchedulerJob.ts:72`, `Scheduler.ts:879`).
7. Worker odbiera `AGENT_BACKGROUND_TASK`, sprawdza tenant envelope, claimuje receipt, woła `executeBackgroundPlan`, a następnie `finishAgentTask(..., true)` po każdym normalnym powrocie (`aiWorker.ts:94-113`).
8. `executeBackgroundPlan` ładuje plan, wiąże organizację/użytkownika i deleguje kroki do `executeToolCall` (`agentPlannerService.ts:1018-1071`).
9. Backend utrwala status planu i kroków. Front odpytywałby `GET /api/ai/agent-plan/:id` co interwał (`AgentPlanPanel.tsx:256,272,289-290`) i mapuje statusy kroków do canvasu (`:456-466`).
10. UI po kliknięciu ignoruje pole `dispatch`: `runAgentPlan` zwraca `{ plan, dispatch }` (`agentPlan.api.ts:180-197`), lecz `AgentPlanPanel.tsx:369` destrukturyzuje wyłącznie `plan`. Użytkownik nie dostaje więc uczciwego sygnału `disabled`, `pending` ani `enqueued`.

### Osobne breakpointy

- **Flaga:** front domyślnie pokazuje powierzchnię, backend/worker domyślnie nie wykonują. Są to różne bramki i różne defaulty.
- **Enqueue:** receipt może zostać `PENDING`, jeżeli kolejka nie odpowie w 5 s (`agentTaskDispatchService.ts:104-120`); UI nie pokazuje `dispatch`.
- **Worker:** bez `ENABLE_AI_TASKS_WORKER=true` nie powstaje consumer.
- **Provider:** `search_knowledge_base` może wejść do embedding/rerankera; brak dostawcy nie był testowany, bo dostawca był zakazany.
- **Status:** znaleziony defekt powoduje `receipt=SUCCEEDED`, choć `plan/step=awaiting_approval` i `completed_steps=0`.
- **Front:** polling pokazuje status planu, lecz nie stan receipt/kolejki; po `run` brak komunikatu o rzeczywistym dispatchu.

### Realny frontend

Vite uruchomiono na 4996 bez override flagi. Wejście `http://127.0.0.1:4996/agent-plan` realnie przekierowało do `http://127.0.0.1:4996/login?redirect=%2Fmy-work%3Ftab%3Dagent`. Widok logowania wyrenderował się poprawnie. Dalsza powierzchnia wymagała danych logowania/PIN, których instrukcja nie dostarczyła; nie zgadywano poświadczeń. Zatem dostępność trasy i domyślna flaga są **PROVEN**, a post-auth render panelu w tym dyżurze jest **NOT PROVEN**.

## R2. Lokalny eksperyment przez realny ApiGateway, PostgreSQL, Redis i worker

Dodano wyłącznie licencjonowany test kontraktowy `server/src/workers/__tests__/day164.agent-dispatch-map.test.ts`. Uruchomienie miało wszystkie efektywne zmienne w tej samej komendzie: `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DAY164_EFFECTIVE_DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6052/cx164 ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false ENABLE_AI_TASKS_WORKER=true MOCK_REDIS=false REDIS_URL=redis://127.0.0.1:6394 ... --retry=0`.

`DAY164_EFFECTIVE_DB_TYPE` jest konieczny tylko dlatego, że oba repozytoryjne configi Vitest nadpisują przekazane `DB_TYPE=postgres` na `sqlite`. Test przywraca jawnie żądany typ przed dynamicznym importem aplikacji; globalnej konfiguracji nie zmieniono. Sonda `assertRealPostgresTestEnvironment` potwierdziła `127.0.0.1:6052/cx164`.

Realny przebieg:

- `POST /api/ai/agent-plan` przez produkcyjny `ApiGateway`: HTTP 201, draft, `dispatch=deferred`;
- `POST /api/ai/agent-plan/:id/run`: HTTP 200, `dispatch=enqueued`;
- BullMQ i realny worker odebrały job;
- krok `generate_report_section` został prawidłowo sklasyfikowany jako `requires_approval=true`, więc narzędzie nie zostało wykonane;
- worker uznał normalny powrót na checkpoint za sukces i zamknął receipt jako `SUCCEEDED`.

Surowy readback po czterech powtórzeniach dowodowych daje ten sam wynik 4/4:

| warstwa | obserwacja |
|---|---|
| receipts | 4 × `SUCCEEDED`, `attempt_count=1`, `last_error_code=NULL` |
| attempts | każdy receipt: `CLAIMED`, następnie `SUCCEEDED` |
| plans | 4 × `awaiting_approval`, `total_steps=1`, `completed_steps=0`, `current_step_index=0` |
| steps | 4 × `generate_report_section`, `awaiting_approval`, `requires_approval=true`, `result_json=NULL`, `duration_ms=NULL` |

To jest **blokujący false success**, nie brak infrastruktury. Receipt stwierdza wykonanie zakończone sukcesem, choć żadne narzędzie nie ruszyło. Przyczyna: `executePlan` prawidłowo wraca na checkpoint, `executeBackgroundPlan` propaguje normalny return, a `aiWorker.ts:110-111` bezwarunkowo wywołuje `finishAgentTask(..., true)`.

Kontrakt RED celowo wymaga, aby receipt nie był `SUCCEEDED` podczas `awaiting_approval`. Wynik JSON: 1 test, 0 passed, 1 failed; pełna nazwa: `Day 164 agent execution through production ApiGateway, real PostgreSQL and Redis does not close the durable receipt as SUCCEEDED while the plan awaits approval`. Artefakt: `/private/tmp/cx-day164-agent-nie-wykonuje-artefakty/day164-r2-final.json`.

Zgodnie z instrukcją R2 zatrzymano na pierwszym blokującym defekcie. Nie zatwierdzano kroku, nie uruchamiano narzędzia, nie użyto LLM i nie naprawiano produktu.

## R3. Granice ryzyka działania agenta

### a. Wywołania modelu

Statycznie dostępnych jest 11 nazw narzędzi w PlanBuilder/ProcessLibrary. Dziesięć ścieżek jest zasadniczo deterministycznych lub DB-only. `search_knowledge_base` przechodzi przez `ragService.hybridSearch`; może wykonać 1 embedding oraz, przy rerankingu i maksymalnie 10 dokumentach w batchach po 5, do 2 wywołań chat — nominalnie do 3 wywołań dostawcy na próbę kroku. Limit planu to 12 kroków (`agent-plan.routes.ts:119,151`). Retry kroku to 3 (`agentPlannerService.ts:1237+`), a job Bull ma `attempts:3` (`aiQueue.ts:42-47`). Nominalny plan bez retry: do 36 wywołań; konfiguracyjny pułap przy powtórzeniach może wzrosnąć do 108, a przy ponowieniu całego joba nawet do 324. Ponieważ catch/idempotencja różnią się między narzędziami, twardy rzeczywisty upper bound jest **NOT PROVEN**. Brak budżetu planu; `estimatedCostUsd` w tej ścieżce jest wpisane jako 0 (`agentPlannerService.ts:1058`).

### b. E-maile i zaproszenia

Nie znaleziono bezpośredniego importu `meetingInvitationService` ani `emailService` na wykonanej ścieżce. `meetingInvitationService.ts:21-23` wymaga jednocześnie `MEETING_INVITES_LIVE=true`, `SMTP_HOST` i `SMTP_USER`. Mimo to `schedule_meeting` należy do `SIDE_EFFECT_TOOLS`; przyszłe podpięcie transportu jest ryzykiem i musi pozostać za aprobatą. W tym dyżurze wysyłka: 0.

### c. Zapisy do DB i bramka akceptu

`SIDE_EFFECT_TOOLS` zawiera 8 nazw, m.in. `generate_report_section`, `schedule_meeting`, `create_notebook_entry`, `query_structured_data`, `create_task`, `update_task`, `create_decision` (`sideEffectTools.ts:17-30`). `createPlan` przelicza bramkę (`agentPlannerService.ts:393-396`), a executor zatrzymuje się przed narzędziem (`:511-540`). Plan, kroki, receipts i attempts są zapisywane przed/po wykonaniu. Wybrane narzędzia zapisują też rekordy domenowe. Sama bramka działa; wadliwe jest zamknięcie receipt po checkpointcie.

### d. Anulowanie i przerwanie

`cancelPlan` tylko ustawia plan na `cancelled` i zmienia `pending/awaiting_approval` na `skipped` (`agentPlannerService.ts:827-834`). Nie usuwa joba Bull, nie wysyła `AbortSignal` i nie przerywa bieżącego narzędzia. Pętla wykonawcza nie odczytuje ponownie stanu anulowania przed utrwaleniem wyniku. In-flight side effect może więc zakończyć się po anulowaniu i nadpisać/rozjechać status. To **BLOCKER**.

### e. Limity czasu, kosztu i liczby kroków

Twardy limit 12 kroków istnieje. Timeout 5 s dotyczy tylko enqueue, nie wykonania. Lease 300 s/heartbeat nie jest abortem narzędzia. Nie znaleziono twardego timeoutu planu/kroku, `AbortController` dla tej ścieżki ani realnego budżetu kosztu. Koszt `0` nie jest pomiarem. To **BLOCKER** dla włączenia.

### f. Częściowa porażka i rollback

Krok ma do 3 prób. Błąd kroku jest utrwalany, ale plan kontynuuje i kończy jako `completed_with_errors`; wcześniejsze side effecty nie są cofane. Bull może ponowić cały job 3 razy. Brak transakcji obejmującej plan oraz brak rollbacku zewnętrznych skutków. Operation key ogranicza część duplikacji, ale nie udowadnia idempotencji wszystkich providerów/narzędzi. Wynik: częściowa porażka jest widoczna na poziomie planu, lecz kompensacja i pełna exactly-once semantyka są **NOT PROVEN**.

## R4. Rekomendacja właścicielska

### Blokery przed jakimkolwiek włączeniem

1. Receipt nie może przechodzić do `SUCCEEDED`, jeśli plan wraca jako `awaiting_approval`, `paused`, `scheduled` lub inny nieterminalny stan. Potrzebny kontrakt GREEN na realnym PG+Redis+worker.
2. UI musi pokazywać prawdziwy wynik `dispatch` (`disabled/pending/enqueued`) i stan receipt, nie tylko plan.
3. Anulowanie musi zatrzymywać/odrzucać job oraz bieżące wykonanie, z fencingiem chroniącym przed późnym zapisem.
4. Muszą istnieć egzekwowalne timeouty planu/kroku i realny limit kosztu/provider calls.
5. Trzeba sklasyfikować każde narzędzie pod kątem side effectu, idempotencji i kompensacji; zewnętrzne skutki wymagają testu retry/redrive/cancel.
6. Należy usunąć sprzeczność defaultów: front ON kontra backend worker OFF oraz nieaktualne komentarze.

### Usprawnienia, nie blokery

- osobny ekran/telemetria receipts i attempts;
- czytelne rozróżnienie `awaiting approval` od `finished` w historii;
- udokumentowany kalkulator górnej granicy provider calls dla konkretnego planu;
- post-auth test przeglądarkowy dla panelu po dostarczeniu legalnego fixture auth.

Rekomendacja: **nie włączać flagi na środowisku współdzielonym ani produkcyjnym**. Można kontynuować wyłącznie lokalne prace kontraktowe i naprawę defektów powyżej. Nie podaję estymacji godzinowej.

## Zbieżność i rozbieżność z tipem instrukcji

Marker jest przodkiem bieżącego tipa `github-backup/codex/m03-admin-20260824` (`22124537f7c4e5ac523dc97ada2291f955721e3c`). W zakresie markera→tip znajduje się m.in. commit `65701fd6aa pomiar: agent WYKONUJE realna prace — defekt jest w kluczu idempotencji przy wznowieniu`. Nie przenoszono żadnej późniejszej poprawki ani dowodu do tego dyżuru. Wynik niniejszego pomiaru dotyczy wyłącznie markera `23bc57aaf3` i ujawnia wcześniejszy, niezależny defekt false-success na checkpointcie aprobaty.

## Claims not verified / twierdzenia niezweryfikowane

- Post-auth render i zachowanie panelu w realnej przeglądarce: **NOT PROVEN** (brak licencjonowanych poświadczeń/PIN).
- Zachowanie po realnej aprobacie kroku i wznowieniu: **NOT RUN**, bo R2 zatrzymano na blokującym defekcie.
- Realny provider/LLM, embedding i reranker: **NOT RUN** zgodnie z zakazem; liczby są analizą statyczną.
- Twardy upper bound wywołań providerów przy wszystkich kombinacjach retry/redrive: **NOT PROVEN**.
- Skuteczność anulowania w trakcie realnego side effectu: **NOT RUN**; brak mechanizmu przerwania stwierdzono statycznie.
- Exactly-once i rollback dla wszystkich 11 narzędzi: **NOT PROVEN**.
- Sekcja `§0.4a`, do której odsyła instrukcja, nie występuje w odczytanym pliku instrukcji; nie można było zastosować nieistniejącego kontraktu pokrycia. Wykonano zamiast tego wąski test kontraktowy zmienionego/dodanego pliku z pełną nazwą i JSON.

## Sprzątanie zasobów własnych

Po utrwaleniu dowodów zatrzymano Vite i usunięto wyłącznie kontenery `cx-day164-pg` oraz `cx-day164-redis`. Końcowa kontrola nie wykazała listenerów na 6052, 4996, 4997 ani 6394. Dane pomiarowe pozostają w logach/JSON w katalogu artefaktów; disposable DB została usunięta razem z kontenerem.
